import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { validate, projectSchema, projectUpdateSchema, collaborationReviewSchema, collaborationRequestSchema, getPagination } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../lib/errors';

export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, category, status, technology, sort } = req.query as Record<string, string>;
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);

    const where = {
      ...(q && { title: { contains: q, mode: 'insensitive' as const } }),
      ...(category && { category }),
      ...(technology && { techStack: { has: technology } }),
      status: status
        ? (status as 'IDEA' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED')
        : { not: 'CANCELLED' as const },
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        select: {
          id: true, title: true, description: true, category: true,
          status: true, techStack: true, requiredSkills: true,
          owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          _count: { select: { memberships: true } },
        },
        orderBy: sort === 'title'
          ? { title: 'asc' }
          : sort === 'status'
            ? [{ status: 'asc' }, { title: 'asc' }]
            : { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ success: true, data: { projects, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
        community: { select: { id: true, name: true, slug: true } },
        memberships: {
          include: {
            user: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
          },
        },
        _count: { select: { memberships: true, collaborations: true } },
      },
    });

    if (!project) throw new NotFoundError('Project');

    res.json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { body } = validate(projectSchema, { body: req.body });
    if (body.communityId) {
      const membership = await prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: req.user!.id, communityId: body.communityId } },
      });
      if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenError('You must be a community member to create a project there');
    }

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: { ...body, ownerId: req.user!.id },
      });

      await tx.projectMembership.create({
        data: { projectId: p.id, userId: req.user!.id, role: 'OWNER' },
      });

      return p;
    });

    res.status(201).json({ success: true, data: { project } });
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new NotFoundError('Project');
    if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the project owner can update this project');
    }

    const { body } = validate(projectUpdateSchema, { body: req.body });

    if (body.communityId && body.communityId !== project.communityId) {
      const membership = await prisma.communityMembership.findUnique({
        where: { userId_communityId: { userId: req.user!.id, communityId: body.communityId } },
      });
      if (req.user!.role !== 'ADMIN' && (!membership || membership.status !== 'ACTIVE')) {
        throw new ForbiddenError('You must be a community member to move this project');
      }
    }

    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: body,
    });

    res.json({ success: true, data: { project: updated } });
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new NotFoundError('Project');
    if (project.ownerId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the project owner can archive this project');
    }
    await prisma.project.update({ where: { id: project.id }, data: { status: 'CANCELLED' } });
    res.json({ success: true, message: 'Project archived' });
  } catch (err) {
    next(err);
  }
}

export async function requestCollaboration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new NotFoundError('Project');
    if (project.ownerId === req.user!.id) throw new ValidationError('You already own this project');
    if (project.status === 'CANCELLED' || project.status === 'COMPLETED') {
      throw new ValidationError('This project is not accepting collaborators');
    }

    const existing = await prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user!.id } },
    });
    if (existing) throw new ConflictError('You are already a member of this project');

    const existingRequest = await prisma.collaborationRequest.findFirst({
      where: { projectId: req.params.id, senderId: req.user!.id, status: 'PENDING' },
    });
    if (existingRequest) throw new ConflictError('You already have a pending request');

    const { body } = validate(collaborationRequestSchema, { body: req.body });
    const message = body.message ?? '';
    const request = await prisma.collaborationRequest.create({
      data: {
        projectId: req.params.id,
        senderId: req.user!.id,
        message: message || null,
      },
    });

    // Notify project owner
    await prisma.notification.create({
      data: {
        userId: project.ownerId,
        type: 'COLLABORATION_REQUEST',
        title: 'New collaboration request',
        message: `Someone wants to join your project: ${project.title}`,
        data: { requestId: request.id, projectId: project.id },
      },
    });

    res.status(201).json({ success: true, data: { request } });
  } catch (err) {
    next(err);
  }
}

export async function reviewCollaboration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new NotFoundError('Project');
    if (project.ownerId !== req.user!.id) throw new ForbiddenError('Only the project owner can review requests');

    const request = await prisma.collaborationRequest.findUnique({
      where: { id: req.params.requestId },
    });
    if (!request || request.projectId !== req.params.id) throw new NotFoundError('Request');
    if (request.status !== 'PENDING') throw new ValidationError('This collaboration request has already been reviewed');

    const { body } = validate(collaborationReviewSchema, { body: req.body });
    const { action } = body;

    await prisma.$transaction(async (tx) => {
      await tx.collaborationRequest.update({
        where: { id: req.params.requestId },
        data: { status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED' },
      });

      if (action === 'ACCEPT') {
        if (project.maxTeamSize) {
          const memberCount = await tx.projectMembership.count({ where: { projectId: req.params.id } });
          if (memberCount >= project.maxTeamSize) {
            throw new ValidationError('This project has reached its maximum team size');
          }
        }
        await tx.projectMembership.create({
          data: { projectId: req.params.id, userId: request.senderId },
        });
      }

      await tx.notification.create({
        data: {
          userId: request.senderId,
          type: action === 'ACCEPT' ? 'COLLABORATION_ACCEPTED' : 'COLLABORATION_REJECTED',
          title: action === 'ACCEPT' ? 'Collaboration request accepted' : 'Collaboration request rejected',
          message: action === 'ACCEPT'
            ? `You've been added to the project: ${project.title}`
            : `Your request to join ${project.title} was not accepted`,
        },
      });
    });

    res.json({ success: true, message: `Request ${action.toLowerCase()}ed` });
  } catch (err) {
    next(err);
  }
}

export async function listProjectMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const members = await prisma.projectMembership.findMany({
      where: { projectId: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, avatarUrl: true, skills: true } },
          },
        },
      },
    });

    res.json({ success: true, data: { members } });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) throw new NotFoundError('Project');
    if (project.ownerId !== req.user!.id) throw new ForbiddenError('Only the project owner can remove members');
    if (req.params.userId === project.ownerId) throw new ValidationError('The project owner cannot be removed');

    await prisma.projectMembership.delete({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });

    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    next(err);
  }
}
