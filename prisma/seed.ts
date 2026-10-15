import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

type UserRole = 'ADMIN' | 'STUDENT';
type MembershipRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'BANNED';
type CommunityVisibility = 'PUBLIC' | 'PRIVATE';
type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
type ProjectStatus = 'IDEA' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';
type CollaborationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
type NotificationType =
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED'
  | 'MEMBERSHIP_REQUEST'
  | 'EVENT_REGISTERED'
  | 'EVENT_UPDATED'
  | 'EVENT_CANCELLED'
  | 'PROJECT_INVITE'
  | 'COLLABORATION_REQUEST'
  | 'COLLABORATION_ACCEPTED'
  | 'COLLABORATION_REJECTED'
  | 'COMMUNITY_ANNOUNCEMENT'
  | 'GENERAL';
type ResourceType = 'ROOM' | 'EQUIPMENT' | 'SOFTWARE' | 'OTHER';
type ReportStatus = 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';

interface SeedUser {
  email: string;
  role: UserRole;
  displayName: string;
  passwordGroup: 'admin' | 'student';
  profile: {
    bio?: string;
    college?: string;
    course?: string;
    academicYear?: string;
    skills?: string[];
    interests?: string[];
    githubUrl?: string;
    linkedinUrl?: string;
    isPublic: boolean;
  };
}

interface SeedData {
  users: SeedUser[];
  admins: Array<{ email: string; permissions: string[] }>;
  communities: Array<{
    slug: string;
    name: string;
    description: string;
    category: string;
    objectives: string;
    rules: string;
    visibility: CommunityVisibility;
    ownerEmail: string;
    tags: string[];
  }>;
  memberships: Array<{
    userEmail: string;
    communitySlug: string;
    role: MembershipRole;
    status: MembershipStatus;
  }>;
  events: Array<{
    id: string;
    title: string;
    description: string;
    communitySlug: string;
    creatorEmail: string;
    venue: string;
    startAt: string;
    endAt: string;
    maxCapacity: number;
    status: EventStatus;
    tags: string[];
  }>;
  eventRegistrations: Array<{ eventId: string; userEmail: string }>;
  projects: Array<{
    id: string;
    title: string;
    description: string;
    objectives: string;
    techStack: string[];
    category: string;
    status: ProjectStatus;
    ownerEmail: string;
    communitySlug?: string;
    repoUrl?: string;
    requiredSkills: string[];
    maxTeamSize: number;
    tags: string[];
  }>;
  projectMemberships: Array<{ projectId: string; userEmail: string; role: MembershipRole }>;
  collaborationRequests: Array<{
    id: string;
    projectId: string;
    senderEmail: string;
    requesterEmail: string;
    message: string;
    status: CollaborationStatus;
  }>;
  discussions: Array<{
    id: string;
    title: string;
    body: string;
    communitySlug: string;
    authorEmail: string;
  }>;
  comments: Array<{
    id: string;
    discussionId: string;
    authorEmail: string;
    body: string;
  }>;
  notifications: Array<{
    id: string;
    userEmail: string;
    type: NotificationType;
    title: string;
    message: string;
  }>;
  resources: Array<{
    id: string;
    title: string;
    description: string;
    type: ResourceType;
    location?: string;
    url?: string;
    capacity?: number;
    ownerEmail: string;
    communitySlug?: string;
  }>;
  reports: Array<{
    id: string;
    reporterEmail: string;
    reportedUserEmail: string;
    contentType: string;
    contentId: string;
    reason: string;
    details: string;
    status: ReportStatus;
  }>;
}

const prisma = new PrismaClient();
const dataPath = resolve(process.cwd(), 'CampusConnectDataFiles', 'seed-data.json');
const seedData = JSON.parse(readFileSync(dataPath, 'utf8')) as SeedData;

function required<T>(map: Map<string, T>, key: string, kind: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Seed data references unknown ${kind}: ${key}`);
  }
  return value;
}

function tagConnections(names: string[]) {
  return {
    connectOrCreate: names.map((name) => ({
      where: { name },
      create: { name },
    })),
  };
}

async function main(): Promise<void> {
  console.log(`Seeding database from ${dataPath}`);
  const isProduction = process.env.NODE_ENV === 'production';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (isProduction && !adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD must be set before seeding in production');
  }

  const users = new Map<string, { id: string }>();
  for (const record of seedData.users) {
    if (isProduction && record.role !== 'ADMIN') continue;

    const password =
      record.passwordGroup === 'admin'
        ? adminPassword ?? 'Admin@123456'
        : process.env.SEED_DEMO_PASSWORD ?? 'Student@123456';
    const passwordHash = await bcrypt.hash(password, 12);
    const profile = {
      displayName: record.displayName,
      ...record.profile,
    };
    const user = await prisma.user.upsert({
      where: { email: record.email },
      update: {
        role: record.role,
        profile: {
          upsert: {
            create: profile,
            update: profile,
          },
        },
      },
      create: {
        email: record.email,
        passwordHash,
        role: record.role,
        emailVerified: true,
        profile: { create: profile },
      },
      select: { id: true },
    });
    users.set(record.email, user);
  }

  for (const record of seedData.admins) {
    const user = required(users, record.email, 'admin user');
    await prisma.admin.upsert({
      where: { userId: user.id },
      update: { permissions: record.permissions },
      create: { userId: user.id, permissions: record.permissions },
    });
  }

  if (isProduction) {
    console.log('Production admin account seeded; demo data is disabled.');
    return;
  }

  const communities = new Map<string, { id: string }>();
  for (const record of seedData.communities) {
    const owner = required(users, record.ownerEmail, 'user');
    const community = await prisma.community.upsert({
      where: { slug: record.slug },
      update: {
        name: record.name,
        description: record.description,
        category: record.category,
        objectives: record.objectives,
        rules: record.rules,
        visibility: record.visibility,
        ownerId: owner.id,
        tags: tagConnections(record.tags),
      },
      create: {
        slug: record.slug,
        name: record.name,
        description: record.description,
        category: record.category,
        objectives: record.objectives,
        rules: record.rules,
        visibility: record.visibility,
        ownerId: owner.id,
        tags: tagConnections(record.tags),
      },
      select: { id: true },
    });
    communities.set(record.slug, community);
  }

  for (const record of seedData.memberships) {
    const user = required(users, record.userEmail, 'user');
    const community = required(communities, record.communitySlug, 'community');
    await prisma.communityMembership.upsert({
      where: { userId_communityId: { userId: user.id, communityId: community.id } },
      update: { role: record.role, status: record.status },
      create: {
        userId: user.id,
        communityId: community.id,
        role: record.role,
        status: record.status,
        joinedAt: record.status === 'ACTIVE' ? new Date() : null,
      },
    });
  }

  const events = new Map<string, { id: string }>();
  for (const record of seedData.events) {
    const creator = required(users, record.creatorEmail, 'user');
    const community = required(communities, record.communitySlug, 'community');
    const values = {
      title: record.title,
      description: record.description,
      communityId: community.id,
      creatorId: creator.id,
      venue: record.venue,
      startAt: new Date(record.startAt),
      endAt: new Date(record.endAt),
      maxCapacity: record.maxCapacity,
      status: record.status,
      tags: record.tags,
      tagRecords: tagConnections(record.tags),
    };
    const existing = await prisma.event.findFirst({
      where: { title: record.title, creatorId: creator.id },
      select: { id: true },
    });
    const event = existing
      ? await prisma.event.update({ where: { id: existing.id }, data: values, select: { id: true } })
      : await prisma.event.create({
          data: { id: record.id, ...values },
          select: { id: true },
        });
    events.set(record.id, event);
  }

  for (const record of seedData.eventRegistrations) {
    const event = required(events, record.eventId, 'event');
    const user = required(users, record.userEmail, 'user');
    await prisma.eventRegistration.upsert({
      where: { eventId_userId: { eventId: event.id, userId: user.id } },
      update: {},
      create: { eventId: event.id, userId: user.id },
    });
  }

  const projects = new Map<string, { id: string }>();
  for (const record of seedData.projects) {
    const owner = required(users, record.ownerEmail, 'user');
    const community = record.communitySlug
      ? required(communities, record.communitySlug, 'community')
      : undefined;
    const values = {
      title: record.title,
      description: record.description,
      objectives: record.objectives,
      techStack: record.techStack,
      category: record.category,
      status: record.status,
      ownerId: owner.id,
      communityId: community?.id,
      repoUrl: record.repoUrl,
      requiredSkills: record.requiredSkills,
      maxTeamSize: record.maxTeamSize,
      tags: tagConnections(record.tags),
    };
    const existing = await prisma.project.findFirst({
      where: { title: record.title, ownerId: owner.id },
      select: { id: true },
    });
    const project = existing
      ? await prisma.project.update({ where: { id: existing.id }, data: values, select: { id: true } })
      : await prisma.project.create({
          data: { id: record.id, ...values },
          select: { id: true },
        });
    projects.set(record.id, project);
  }

  for (const record of seedData.projectMemberships) {
    const project = required(projects, record.projectId, 'project');
    const user = required(users, record.userEmail, 'user');
    await prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
      update: { role: record.role },
      create: { projectId: project.id, userId: user.id, role: record.role },
    });
  }

  for (const record of seedData.collaborationRequests) {
    const project = required(projects, record.projectId, 'project');
    const sender = required(users, record.senderEmail, 'user');
    const requester = required(users, record.requesterEmail, 'user');
    await prisma.collaborationRequest.upsert({
      where: { id: record.id },
      update: {
        projectId: project.id,
        senderId: sender.id,
        requesterId: requester.id,
        message: record.message,
        status: record.status,
      },
      create: {
        id: record.id,
        projectId: project.id,
        senderId: sender.id,
        requesterId: requester.id,
        message: record.message,
        status: record.status,
      },
    });
  }

  const discussions = new Map<string, { id: string }>();
  for (const record of seedData.discussions) {
    const community = required(communities, record.communitySlug, 'community');
    const author = required(users, record.authorEmail, 'user');
    const existing = await prisma.discussion.findFirst({
      where: { title: record.title, communityId: community.id, authorId: author.id },
      select: { id: true },
    });
    const discussion = existing
      ? await prisma.discussion.update({
          where: { id: existing.id },
          data: { body: record.body },
          select: { id: true },
        })
      : await prisma.discussion.create({
          data: {
            id: record.id,
            title: record.title,
            body: record.body,
            communityId: community.id,
            authorId: author.id,
          },
          select: { id: true },
        });
    discussions.set(record.id, discussion);
  }

  for (const record of seedData.comments) {
    const discussion = required(discussions, record.discussionId, 'discussion');
    const author = required(users, record.authorEmail, 'user');
    await prisma.comment.upsert({
      where: { id: record.id },
      update: { body: record.body, discussionId: discussion.id, authorId: author.id },
      create: {
        id: record.id,
        body: record.body,
        discussionId: discussion.id,
        authorId: author.id,
      },
    });
  }

  for (const record of seedData.notifications) {
    const user = required(users, record.userEmail, 'user');
    await prisma.notification.upsert({
      where: { id: record.id },
      update: { type: record.type, title: record.title, message: record.message },
      create: {
        id: record.id,
        userId: user.id,
        type: record.type,
        title: record.title,
        message: record.message,
      },
    });
  }

  for (const record of seedData.resources) {
    const owner = required(users, record.ownerEmail, 'user');
    const community = record.communitySlug
      ? required(communities, record.communitySlug, 'community')
      : undefined;
    await prisma.resource.upsert({
      where: { id: record.id },
      update: {
        title: record.title,
        description: record.description,
        type: record.type,
        location: record.location,
        url: record.url,
        capacity: record.capacity,
        ownerId: owner.id,
        communityId: community?.id,
      },
      create: {
        id: record.id,
        title: record.title,
        description: record.description,
        type: record.type,
        location: record.location,
        url: record.url,
        capacity: record.capacity,
        ownerId: owner.id,
        communityId: community?.id,
      },
    });
  }

  for (const record of seedData.reports) {
    const reporter = required(users, record.reporterEmail, 'user');
    const reportedUser = required(users, record.reportedUserEmail, 'user');
    await prisma.report.upsert({
      where: { id: record.id },
      update: {
        reporterId: reporter.id,
        reportedUserId: reportedUser.id,
        contentType: record.contentType,
        contentId: record.contentId,
        reason: record.reason,
        details: record.details,
        status: record.status,
      },
      create: {
        id: record.id,
        reporterId: reporter.id,
        reportedUserId: reportedUser.id,
        contentType: record.contentType,
        contentId: record.contentId,
        reason: record.reason,
        details: record.details,
        status: record.status,
      },
    });
  }

  console.log('Database seeded successfully with demo campus data.');
  console.log('Demo students use Student@123456 unless SEED_DEMO_PASSWORD is set.');
  console.log('Demo admin uses SEED_ADMIN_PASSWORD or Admin@123456 for local development.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
