import type { Community, Discussion, Event as CampusEvent, Project, UserProfile } from '@campusconnect/types';

type DemoPerson = {
  id: string;
  profile: UserProfile;
};

type DemoCommunity = Community & {
  objectives: string;
  rules: string;
  _count: { memberships: number; events: number; projects: number };
};

type DemoEvent = CampusEvent & {
  maxCapacity: number;
  tags: string[];
  creator: { id: string; profile: { displayName: string } };
  _count: { registrations: number };
};

type DemoProject = Project & {
  objectives: string;
  techStack: string[];
  requiredSkills: string[];
  owner: { id: string; profile: { displayName: string; avatarUrl: string | null } };
  community: { id: string; name: string; slug: string } | null;
  memberships: { user: { id: string; profile: { displayName: string } } }[];
  repoUrl: string | null;
  demoUrl: string | null;
};

type DemoComment = {
  id: string;
  body: string;
  parentId: string | null;
  createdAt: string;
  author: { id: string; profile: { displayName: string; avatarUrl: string | null } };
  replies?: DemoComment[];
};

const dateAt = (offsetDays: number, hour = 12): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

const people: DemoPerson[] = [
  {
    id: 'demo-person-mira',
    profile: {
      userId: 'demo-person-mira', displayName: 'Mira Sen', bio: 'Computer science student who likes making campus tools easier for everyone to use.',
      avatarUrl: null, college: 'Northbridge University', course: 'BSc Computer Science', skills: ['React', 'Accessibility', 'Mapping'],
      interests: ['Open source', 'Civic technology', 'Walking routes'], isPublic: true,
    },
  },
  {
    id: 'demo-person-rohan',
    profile: {
      userId: 'demo-person-rohan', displayName: 'Rohan Iyer', bio: 'Design student collecting small details that make digital products feel more welcoming.',
      avatarUrl: null, college: 'Westlake Institute', course: 'BA Interaction Design', skills: ['Figma', 'Research', 'Prototyping'],
      interests: ['Product design', 'Photography', 'Community spaces'], isPublic: true,
    },
  },
  {
    id: 'demo-person-leah',
    profile: {
      userId: 'demo-person-leah', displayName: 'Leah Fernandes', bio: 'Electrical engineering student building practical sensors for shared spaces.',
      avatarUrl: null, college: 'Eastmere College', course: 'BEng Electrical Engineering', skills: ['ESP32', 'C++', 'Data visualization'],
      interests: ['Climate action', 'Gardening', 'Hardware'], isPublic: true,
    },
  },
  {
    id: 'demo-person-kabir',
    profile: {
      userId: 'demo-person-kabir', displayName: 'Kabir Das', bio: 'First-year student, enthusiastic note-taker, and always happy to test an early prototype.',
      avatarUrl: null, college: 'Northbridge University', course: 'BSc Environmental Science', skills: ['Writing', 'Field research', 'Illustration'],
      interests: ['Food sharing', 'Sustainability', 'Zines'], isPublic: true,
    },
  },
];

const personById = (id: string) => people.find((person) => person.id === id)!;
const personName = (id: string) => personById(id).profile.displayName;

const communities: DemoCommunity[] = [
  {
    id: 'demo-community-builders', slug: 'northbridge-builders', name: 'Northbridge Builders Circle',
    description: 'A low-pressure place to find collaborators, share works in progress, and learn by making useful things for campus.',
    category: 'Technology', visibility: 'PUBLIC', objectives: 'Host small build nights and help student ideas find the right teammates.',
    rules: 'Be generous with feedback, credit the people who help, and leave room for beginners.',
    _count: { memberships: 2, events: 1, projects: 1 },
  },
  {
    id: 'demo-community-design', slug: 'westlake-design-lab', name: 'Westlake Design Lab',
    description: 'Students interested in thoughtful interfaces meet here to practice research, critique, and collaborative prototyping.',
    category: 'Design', visibility: 'PUBLIC', objectives: 'Make design practice more social through friendly critique and short workshops.',
    rules: 'Be specific and kind in critique. Ask before sharing someone else’s work outside the group.',
    _count: { memberships: 2, events: 1, projects: 1 },
  },
  {
    id: 'demo-community-green', slug: 'eastmere-green-campus', name: 'Eastmere Green Campus',
    description: 'A practical sustainability group for students who want to improve shared spaces one small experiment at a time.',
    category: 'Sustainability', visibility: 'PUBLIC', objectives: 'Run hands-on projects around campus gardens, reuse, and everyday climate action.',
    rules: 'Keep projects accessible, share what did not work as well as what did, and respect shared spaces.',
    _count: { memberships: 3, events: 2, projects: 2 },
  },
];

const communityRef = (id: string) => {
  const community = communities.find((item) => item.id === id)!;
  return { id: community.id, name: community.name, slug: community.slug };
};

const events: DemoEvent[] = [
  {
    id: 'demo-event-access-jam', title: 'Campus Access Map: Open Build Night',
    description: 'Bring a laptop or a notebook. We will map a few everyday routes, compare notes on accessibility details, and pick one small improvement to ship together.',
    startAt: dateAt(4, 16), endAt: dateAt(4, 18), venue: 'Northbridge Library, Studio 2', status: 'PUBLISHED',
    community: communityRef('demo-community-builders'), maxCapacity: 28, tags: ['Open source', 'Accessibility'],
    creator: { id: 'demo-person-mira', profile: { displayName: personName('demo-person-mira') } }, _count: { registrations: 13 },
  },
  {
    id: 'demo-event-critique', title: 'A Friendly First Portfolio Critique',
    description: 'A relaxed afternoon for sharing one project, asking one honest question, and getting feedback you can actually use. New portfolios and rough drafts welcome.',
    startAt: dateAt(7, 14), endAt: dateAt(7, 16), venue: 'Westlake Design Studio', status: 'PUBLISHED',
    community: communityRef('demo-community-design'), maxCapacity: 20, tags: ['Design', 'Peer feedback'],
    creator: { id: 'demo-person-rohan', profile: { displayName: personName('demo-person-rohan') } }, _count: { registrations: 9 },
  },
  {
    id: 'demo-event-garden-checkin', title: 'Garden Sensor Check-in',
    description: 'Help the team compare soil readings from the student garden and decide what the next sensor test should measure. No hardware experience needed.',
    startAt: dateAt(12, 11), endAt: dateAt(12, 12), venue: 'Eastmere Greenhouse', status: 'PUBLISHED',
    community: communityRef('demo-community-green'), maxCapacity: 16, tags: ['Hardware', 'Sustainability'],
    creator: { id: 'demo-person-leah', profile: { displayName: personName('demo-person-leah') } }, _count: { registrations: 7 },
  },
  {
    id: 'demo-event-zine-table', title: 'Make a Tiny Campus Zine',
    description: 'An informal drop-in to trade campus tips, sketch ideas, and put together a one-page guide for students who are new here.',
    startAt: dateAt(17, 13), endAt: dateAt(17, 15), venue: 'Northbridge Student Commons', status: 'PUBLISHED',
    community: communityRef('demo-community-green'), maxCapacity: 24, tags: ['Community', 'Print'],
    creator: { id: 'demo-person-kabir', profile: { displayName: personName('demo-person-kabir') } }, _count: { registrations: 11 },
  },
];

const projects: DemoProject[] = [
  {
    id: 'demo-project-access-map', title: 'Campus Access Map',
    description: 'A student-maintained map of step-free routes, quiet study spots, and the small details that make getting around campus easier.',
    objectives: 'Start with one clear route between the library and student services, then invite students to review the information.',
    status: 'ACTIVE', category: 'Open Source', techStack: ['React', 'MapLibre', 'TypeScript'], requiredSkills: ['Accessibility', 'Mapping'],
    owner: { id: 'demo-person-mira', profile: { displayName: personName('demo-person-mira'), avatarUrl: null } },
    community: communityRef('demo-community-builders'), memberships: [{ user: { id: 'demo-person-rohan', profile: { displayName: personName('demo-person-rohan') } } }],
    repoUrl: null, demoUrl: null,
  },
  {
    id: 'demo-project-pantry-exchange', title: 'The Pantry Exchange Board',
    description: 'A simple noticeboard prototype that helps student groups share unopened pantry supplies before they go to waste.',
    objectives: 'Test a paper-first version with two student groups before deciding whether a digital tool is useful.',
    status: 'COMPLETED', category: 'Community', techStack: ['Service design', 'Next.js'], requiredSkills: ['Research', 'Writing'],
    owner: { id: 'demo-person-kabir', profile: { displayName: personName('demo-person-kabir'), avatarUrl: null } },
    community: communityRef('demo-community-green'), memberships: [{ user: { id: 'demo-person-leah', profile: { displayName: personName('demo-person-leah') } } }],
    repoUrl: null, demoUrl: null,
  },
  {
    id: 'demo-project-garden-sensors', title: 'Garden Sensor Kit',
    description: 'A small, repairable sensor kit for checking soil moisture in the shared greenhouse without adding another complicated dashboard.',
    objectives: 'Compare two low-cost sensors and document a setup that the next student team can reproduce.',
    status: 'IDEA', category: 'Sustainability', techStack: ['ESP32', 'C++'], requiredSkills: ['Embedded systems', 'Data visualization'],
    owner: { id: 'demo-person-leah', profile: { displayName: personName('demo-person-leah'), avatarUrl: null } },
    community: communityRef('demo-community-green'), memberships: [], repoUrl: null, demoUrl: null,
  },
  {
    id: 'demo-project-welcome-zine', title: 'A Welcome Zine for New Students',
    description: 'A short illustrated guide to the places, people, and unwritten campus tips that are easier to learn from another student.',
    objectives: 'Collect a few useful contributions and make a first print-friendly edition for orientation week.',
    status: 'ON_HOLD', category: 'Student life', techStack: ['Illustration', 'Editorial design'], requiredSkills: ['Editing', 'Illustration'],
    owner: { id: 'demo-person-rohan', profile: { displayName: personName('demo-person-rohan'), avatarUrl: null } },
    community: communityRef('demo-community-design'), memberships: [], repoUrl: null, demoUrl: null,
  },
];

const discussions: (Discussion & {
  createdAt: string;
  author: { id: string; profile: { displayName: string; avatarUrl: string | null } };
  community: { id: string; name: string; slug: string; visibility: string };
  _count: { comments: number };
})[] = [
  {
    id: 'demo-discussion-access-notes', title: 'What should we check on the first map walk?',
    body: 'We have about an hour to review the route between the library and student services. Beyond ramps and lifts, what details have made a route guide genuinely useful for you?',
    communityId: 'demo-community-builders', createdAt: dateAt(-1, 10),
    author: { id: 'demo-person-mira', profile: { displayName: personName('demo-person-mira'), avatarUrl: null } },
    community: { ...communityRef('demo-community-builders'), visibility: 'PUBLIC' }, _count: { comments: 2 },
  },
  {
    id: 'demo-discussion-critique-ritual', title: 'How do you like to receive design feedback?',
    body: 'For Friday’s portfolio session, I am putting together a few gentle prompts. Do you prefer people to ask questions first, or point out what they noticed before offering suggestions?',
    communityId: 'demo-community-design', createdAt: dateAt(-2, 15),
    author: { id: 'demo-person-rohan', profile: { displayName: personName('demo-person-rohan'), avatarUrl: null } },
    community: { ...communityRef('demo-community-design'), visibility: 'PUBLIC' }, _count: { comments: 1 },
  },
  {
    id: 'demo-discussion-garden-readings', title: 'The moisture readings jump around after lunch',
    body: 'Our first sensor test is a little noisier than expected. We are checking placement and watering times this week. Has anyone worked out a simple way to compare readings without overcomplicating the setup?',
    communityId: 'demo-community-green', createdAt: dateAt(-3, 9),
    author: { id: 'demo-person-leah', profile: { displayName: personName('demo-person-leah'), avatarUrl: null } },
    community: { ...communityRef('demo-community-green'), visibility: 'PUBLIC' }, _count: { comments: 1 },
  },
];

const commentsByDiscussion: Record<string, DemoComment[]> = {
  'demo-discussion-access-notes': [
    {
      id: 'demo-comment-map-1', body: 'Door timings and whether the automatic doors are working have been just as useful as the route itself. Could be a good first note to collect.',
      parentId: null, createdAt: dateAt(-1, 12), author: { id: 'demo-person-kabir', profile: { displayName: personName('demo-person-kabir'), avatarUrl: null } },
      replies: [{
        id: 'demo-comment-map-1-reply', body: 'Good call. I can add a quick check for entrances and door buttons to the walk sheet.',
        parentId: 'demo-comment-map-1', createdAt: dateAt(-1, 13), author: { id: 'demo-person-mira', profile: { displayName: personName('demo-person-mira'), avatarUrl: null } },
      }],
    },
    {
      id: 'demo-comment-map-2', body: 'A quiet alternative route would help too, especially when the main corridor gets crowded between classes.',
      parentId: null, createdAt: dateAt(0, 9), author: { id: 'demo-person-rohan', profile: { displayName: personName('demo-person-rohan'), avatarUrl: null } }, replies: [],
    },
  ],
  'demo-discussion-critique-ritual': [{
    id: 'demo-comment-critique-1', body: 'Questions first works well for me. It gives the person sharing a chance to say what kind of feedback would actually be useful that day.',
    parentId: null, createdAt: dateAt(-1, 16), author: { id: 'demo-person-kabir', profile: { displayName: personName('demo-person-kabir'), avatarUrl: null } }, replies: [],
  }],
  'demo-discussion-garden-readings': [{
    id: 'demo-comment-garden-1', body: 'We had a loose connection on our first run. Logging the sensor location and time beside each reading helped us spot the pattern before changing the hardware.',
    parentId: null, createdAt: dateAt(-2, 11), author: { id: 'demo-person-mira', profile: { displayName: personName('demo-person-mira'), avatarUrl: null } }, replies: [],
  }],
};

const memberships: Record<string, string[]> = {
  'demo-person-mira': ['demo-community-builders', 'demo-community-green'],
  'demo-person-rohan': ['demo-community-builders', 'demo-community-design'],
  'demo-person-leah': ['demo-community-green'],
  'demo-person-kabir': ['demo-community-green', 'demo-community-design'],
};

function pageValues(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20));
  return { page, limit };
}

function paginated<T>(items: T[], url: URL, key: string) {
  const { page, limit } = pageValues(url);
  const start = (page - 1) * limit;
  return { [key]: items.slice(start, start + limit), total: items.length, page, limit };
}

function communityDetail(community: DemoCommunity) {
  const relatedEvents = events.filter((event) => event.community?.id === community.id);
  return {
    ...community,
    events: relatedEvents.map(({ id, title, startAt, endAt, venue }) => ({ id, title, startAt, endAt, venue })),
  };
}

function demoUser(id: string) {
  const person = people.find((item) => item.id === id);
  if (!person) return null;
  const memberOf = memberships[id] ?? [];
  return {
    id: person.id,
    role: 'STUDENT',
    profile: person.profile,
    communityMemberships: memberOf.map((communityId) => ({ community: communityRef(communityId) })),
    ownedProjects: projects.filter((project) => project.owner.id === id).map(({ id: projectId, title, status, category }) => ({ id: projectId, title, status, category })),
  };
}

export function getDemoResponse(path: string): unknown | undefined {
  const url = new URL(path, 'http://campusconnect.local');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/communities') {
    const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
    const category = url.searchParams.get('category');
    const filtered = communities.filter((community) =>
      community.name.toLocaleLowerCase().includes(query) && (!category || community.category === category),
    );
    const result = paginated(filtered, url, 'communities');
    return { ...result };
  }

  const communityMatch = pathname.match(/^\/communities\/([^/]+)$/);
  if (communityMatch) {
    const community = communities.find((item) => item.slug === communityMatch[1] || item.id === communityMatch[1]);
    return community ? { community: communityDetail(community) } : undefined;
  }

  if (pathname === '/events') {
    const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
    const communityId = url.searchParams.get('communityId');
    const upcomingOnly = url.searchParams.get('upcoming') === 'true';
    const filtered = events.filter((event) =>
      event.title.toLocaleLowerCase().includes(query) &&
      (!communityId || event.community?.id === communityId) &&
      (!upcomingOnly || new Date(event.startAt).getTime() >= Date.now()),
    );
    const result = paginated(filtered, url, 'events');
    return { ...result };
  }

  const eventMatch = pathname.match(/^\/events\/([^/]+)$/);
  if (eventMatch) {
    const event = events.find((item) => item.id === eventMatch[1]);
    return event ? { event } : undefined;
  }

  if (pathname === '/projects') {
    const query = (url.searchParams.get('q') ?? '').toLocaleLowerCase();
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status');
    const technology = url.searchParams.get('technology');
    const filtered = projects.filter((project) =>
      project.title.toLocaleLowerCase().includes(query) &&
      (!category || project.category === category) &&
      (!technology || project.techStack.includes(technology)) &&
      (status ? project.status === status : project.status !== 'CANCELLED'),
    );
    const sort = url.searchParams.get('sort');
    const sorted = [...filtered];
    if (sort === 'title') sorted.sort((left, right) => left.title.localeCompare(right.title));
    if (sort === 'status') sorted.sort((left, right) => left.status.localeCompare(right.status) || left.title.localeCompare(right.title));
    const result = paginated(sorted, url, 'projects');
    return { ...result };
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = projects.find((item) => item.id === projectMatch[1]);
    return project ? { project } : undefined;
  }

  const communityDiscussionsMatch = pathname.match(/^\/discussions\/community\/([^/]+)$/);
  if (communityDiscussionsMatch) {
    const filtered = discussions.filter((item) => item.communityId === communityDiscussionsMatch[1]);
    const result = paginated(filtered, url, 'discussions');
    return { ...result };
  }

  const commentsMatch = pathname.match(/^\/discussions\/([^/]+)\/comments$/);
  if (commentsMatch) {
    const comments = commentsByDiscussion[commentsMatch[1]];
    return comments ? { comments } : undefined;
  }

  const discussionMatch = pathname.match(/^\/discussions\/([^/]+)$/);
  if (discussionMatch) {
    const discussion = discussions.find((item) => item.id === discussionMatch[1]);
    return discussion ? { discussion } : undefined;
  }

  const userMatch = pathname.match(/^\/users\/(demo-person-[^/]+)$/);
  if (userMatch) {
    const user = demoUser(userMatch[1]);
    return user ? { user } : undefined;
  }

  return undefined;
}