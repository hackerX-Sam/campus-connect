/**
 * A fully mocked `prisma` client for the Connect endpoint tests.
 * All Connect behavior is database-driven, so every query the controllers
 * and the auth middleware make is represented here with a jest.fn().
 * Tests override individual queries with mockResolvedValueOnce chains.
 *
 * Uses the `jest` global injected by Test Environment, not @jest/globals —
 * a shadowing import collides with the injected global in plain JS suites.
 */

const eachModel = (defaults) => {
  const entry = {};
  for (const [method, fallback] of Object.entries(defaults)) {
    entry[method] = jest.fn().mockImplementation(() => Promise.resolve(fallback));
  }
  return entry;
};

const db = {
  user: eachModel({
    findUnique: null,
  }),
  userProfile: eachModel({
    findUnique: null,
    findMany: [],
    count: 0,
  }),
  connection: eachModel({
    findUnique: null,
    findFirst: null,
    findMany: [],
    create: null,
    update: null,
    updateMany: { count: 0 },
    delete: null,
    count: 0,
  }),
  communityMembership: eachModel({
    findMany: [],
  }),
  notification: eachModel({
    create: null,
  }),
  __users: new Map(),
};

function makeUser(id, role = 'STUDENT') {
  return {
    id,
    role,
    email: `${id}@example.com`,
    isActive: true,
    profile: { userId: id, displayName: id },
  };
}

/**
 * Installs stable default behaviors (transaction passthrough, user lookup
 * from the test registry). Called before each test so every test starts clean.
 */
function install() {
  db.$transaction = jest.fn().mockImplementation((work) => work(db));
  db.user.findUnique.mockImplementation(({ where }) =>
    Promise.resolve(db.__users.get(where.id) ?? null)
  );
  // Queries not overridden by a test fall back to harmless no-ops so that
  // an unexpected extra call never crashes the suite silently.
  db.connection.updateMany.mockResolvedValue({ count: 0 });
  db.connection.findMany.mockResolvedValue([]);
  db.connection.findFirst.mockResolvedValue(null);
  db.connection.findUnique.mockResolvedValue(null);
  db.connection.create.mockResolvedValue(null);
  db.connection.update.mockResolvedValue(null);
  db.connection.delete.mockResolvedValue(null);
  db.connection.count.mockResolvedValue(0);
  db.userProfile.findUnique.mockResolvedValue(null);
  db.userProfile.findMany.mockResolvedValue([]);
  db.userProfile.count.mockResolvedValue(0);
  db.communityMembership.findMany.mockResolvedValue([]);
  db.notification.create.mockResolvedValue(null);
  db.__users.clear();
}

module.exports = { makeUser, install };
module.exports.default = db;
module.exports.default.__install = install;
