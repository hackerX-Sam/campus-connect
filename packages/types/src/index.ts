import { z } from 'zod';

export const userRoleSchema = z.enum(['STUDENT', 'ADMIN']);
export const membershipRoleSchema = z.enum(['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER']);
export const communityVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').transform((value) => value.toLowerCase()),
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password too long'),
    displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(60, 'Display name too long'),
  }).strict(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Password is required').max(72),
  }).strict(),
});

export const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().trim().min(2).max(60).optional(),
    bio: z.string().max(500).optional(),
    college: z.string().max(200).optional(),
    course: z.string().max(200).optional(),
    academicYear: z.string().max(20).optional(),
    skills: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
    githubUrl: z.string().url().optional().or(z.literal('')),
    linkedinUrl: z.string().url().optional().or(z.literal('')),
    websiteUrl: z.string().url().optional().or(z.literal('')),
    isPublic: z.boolean().optional(),
  }).strict(),
});

export const communitySchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, 'Name too short').max(100, 'Name too long'),
    description: z.string().trim().min(20, 'Description too short').max(2000),
    category: z.string().trim().min(1).max(80),
    objectives: z.string().max(1000).optional(),
    rules: z.string().max(1000).optional(),
    visibility: communityVisibilitySchema.optional(),
    websiteUrl: z.string().url().optional().or(z.literal('')),
  }).strict(),
});
export const communityUpdateSchema = z.object({
  body: communitySchema.shape.body.partial().strict(),
});

export const eventSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(20).max(3000),
    communityId: z.string().optional(),
    venue: z.string().max(300).optional(),
    meetingLink: z.string().url().optional().or(z.literal('')),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    maxCapacity: z.number().int().positive().max(100000).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  }).strict(),
});

export const eventUpdateSchema = z.object({
  body: eventSchema.shape.body.partial().extend({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
  }).strict(),
});

export const projectSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(20).max(3000),
    objectives: z.string().max(1000).optional(),
    techStack: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    category: z.string().trim().min(1).max(80),
    communityId: z.string().optional(),
    repoUrl: z.string().url().optional().or(z.literal('')),
    demoUrl: z.string().url().optional().or(z.literal('')),
    requiredSkills: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    maxTeamSize: z.number().int().positive().max(50).optional(),
    status: z.enum(['IDEA', 'ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']).optional(),
  }).strict(),
});
export const projectUpdateSchema = z.object({
  body: projectSchema.shape.body.partial().strict(),
});

export const discussionSchema = z.object({
  body: z.object({
    title: z.string().trim().min(5).max(300),
    body: z.string().trim().min(10).max(10000),
  }).strict(),
});

export const commentSchema = z.object({
  body: z.object({
    body: z.string().trim().min(1).max(5000),
    parentId: z.string().optional(),
  }).strict(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const userRoleUpdateSchema = z.object({
  body: z.object({ role: userRoleSchema }).strict(),
});
export const reportStatusSchema = z.object({
  body: z.object({ status: z.enum(['REVIEWED', 'RESOLVED', 'DISMISSED']) }).strict(),
});
export const membershipReviewSchema = z.object({
  body: z.object({ action: z.enum(['APPROVE', 'REJECT']) }).strict(),
});
export const memberRoleUpdateSchema = z.object({
  body: z.object({ role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']) }).strict(),
});
export const collaborationReviewSchema = z.object({
  body: z.object({ action: z.enum(['ACCEPT', 'REJECT']) }).strict(),
});
export const collaborationRequestSchema = z.object({
  body: z.object({ message: z.string().trim().max(1000).optional() }).strict(),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type MembershipRole = z.infer<typeof membershipRoleSchema>;
export type User = {
  id: string;
  email: string;
  role: UserRole;
  profile?: UserProfile | null;
};
export type UserProfile = {
  userId: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  college?: string | null;
  course?: string | null;
  skills: string[];
  interests: string[];
  isPublic: boolean;
};
export type Community = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  visibility: z.infer<typeof communityVisibilitySchema>;
};
export type Event = {
  id: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  venue?: string | null;
  status?: string;
  community?: { id: string; name: string; slug: string } | null;
};
export type Project = { id: string; title: string; description: string; status: string; category?: string };
export type Discussion = { id: string; title: string; body: string; communityId: string };
export type Notification = { id: string; title: string; message: string; isRead: boolean; createdAt: string };
export type Resource = { id: string; title: string; description: string; type: string; location?: string | null };
