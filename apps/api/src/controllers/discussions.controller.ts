import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { validate, discussionSchema, commentSchema, getPagination } from '../lib/validation';
import { AuthRequest } from '../middleware/authenticate';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';

const memberSelect = {
  id: true,
  profile: { select: { displayName: true, avatarUrl: true } },
};

export async function listDiscussions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = getPagination(req.query.page, req.query.limit);
    const community = await prisma.community.findUnique({ where: { id: req.params.communityId }, select: { visibility: true } });
    if (!community) throw new NotFoundError('Community');
    if (community.visibility === 'PRIVATE' && req.user?.role !== 'ADMIN' &&
      (!req.user || !(await prisma.communityMembership.findFirst({ where: { communityId: req.params.communityId, userId: req.user.id, status: 'ACTIVE' }, select: { id: true } })))) {
      throw new NotFoundError('Community');
    }

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where: { communityId: req.params.communityId },
        include: {
          author: { select: memberSelect },
          _count: { select: { comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.discussion.count({ where: { communityId: req.params.communityId } }),
    ]);

    res.json({ success: true, data: { discussions, total, page, limit } });
  } catch (err) {
    next(err);
  }
}

export async function getDiscussion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: memberSelect },
        community: { select: { id: true, name: true, slug: true, visibility: true } },
        _count: { select: { comments: true } },
      },
    });

    if (!discussion) throw new NotFoundError('Discussion');
    if (discussion.community.visibility === 'PRIVATE' && req.user?.role !== 'ADMIN' &&
      (!req.user || !(await prisma.communityMembership.findFirst({ where: { communityId: discussion.communityId, userId: req.user.id, status: 'ACTIVE' }, select: { id: true } })))) {
      throw new NotFoundError('Discussion');
    }

    res.json({ success: true, data: { discussion } });
  } catch (err) {
    next(err);
  }
}

export async function createDiscussion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Verify community membership
    const membership = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId: req.params.communityId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be a member to post in this community');
    }

    const { body } = validate(discussionSchema, { body: req.body });

    const discussion = await prisma.discussion.create({
      data: {
        ...body,
        communityId: req.params.communityId,
        authorId: req.user!.id,
      },
      include: { author: { select: memberSelect } },
    });

    res.status(201).json({ success: true, data: { discussion } });
  } catch (err) {
    next(err);
  }
}

export async function updateDiscussion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const discussion = await prisma.discussion.findUnique({ where: { id: req.params.id } });
    if (!discussion) throw new NotFoundError('Discussion');
    if (discussion.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the author can edit this discussion');
    }

    const { body } = validate(discussionSchema, { body: req.body });

    const updated = await prisma.discussion.update({
      where: { id: req.params.id },
      data: body,
    });

    res.json({ success: true, data: { discussion: updated } });
  } catch (err) {
    next(err);
  }
}

export async function deleteDiscussion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const discussion = await prisma.discussion.findUnique({ where: { id: req.params.id } });
    if (!discussion) throw new NotFoundError('Discussion');
    if (discussion.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the author can delete this discussion');
    }

    await prisma.discussion.delete({ where: { id: req.params.id } });

    res.json({ success: true, message: 'Discussion deleted' });
  } catch (err) {
    next(err);
  }
}

export async function listComments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id: req.params.id },
      include: { community: { select: { visibility: true } } },
    });
    if (!discussion) throw new NotFoundError('Discussion');
    if (discussion.community.visibility === 'PRIVATE' && req.user?.role !== 'ADMIN' &&
      (!req.user || !(await prisma.communityMembership.findFirst({ where: { communityId: discussion.communityId, userId: req.user.id, status: 'ACTIVE' }, select: { id: true } })))) {
      throw new NotFoundError('Discussion');
    }
    const comments = await prisma.comment.findMany({
      where: { discussionId: req.params.id, parentId: null },
      include: {
        author: { select: memberSelect },
        replies: { include: { author: { select: memberSelect } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: { comments } });
  } catch (err) {
    next(err);
  }
}

export async function addComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const discussion = await prisma.discussion.findUnique({ where: { id: req.params.id } });
    if (!discussion) throw new NotFoundError('Discussion');

    const membership = await prisma.communityMembership.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId: discussion.communityId } },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenError('You must be a community member to comment');
    }

    const { body } = validate(commentSchema, { body: req.body });
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: body.parentId }, select: { discussionId: true, parentId: true } });
      if (!parent || parent.discussionId !== req.params.id || parent.parentId !== null) {
        throw new ValidationError('Replies must target an existing top-level comment in this discussion');
      }
    }

    const comment = await prisma.comment.create({
      data: {
        body: body.body,
        discussionId: req.params.id,
        authorId: req.user!.id,
        parentId: body.parentId,
      },
      include: { author: { select: memberSelect } },
    });

    res.status(201).json({ success: true, data: { comment } });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (!comment) throw new NotFoundError('Comment');
    if (comment.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new ForbiddenError('Only the author can delete this comment');
    }

    await prisma.comment.delete({ where: { id: req.params.commentId } });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
}
