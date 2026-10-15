import { z } from 'zod';
import { paginationSchema } from '@campusconnect/types';

export {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  communitySchema,
  communityUpdateSchema,
  eventSchema,
  eventUpdateSchema,
  projectSchema,
  projectUpdateSchema,
  discussionSchema,
  commentSchema,
  paginationSchema,
  userRoleUpdateSchema,
  reportStatusSchema,
  membershipReviewSchema,
  memberRoleUpdateSchema,
  collaborationReviewSchema,
  collaborationRequestSchema,
} from '@campusconnect/types';

/**
 * Validates a request object against a Zod schema.
 * Throws ZodError (caught by errorHandler) on failure.
 */
export function validate<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  return schema.parse(data);
}

export function getPagination(page: unknown, limit: unknown) {
  const parsed = paginationSchema.parse({ page, limit });
  return { ...parsed, skip: (parsed.page - 1) * parsed.limit };
}
