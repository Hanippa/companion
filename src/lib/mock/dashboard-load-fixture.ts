export type MockDashboardOrganization = {
  id: number
  name: string
  notes: string
  status: "active" | "inactive"
}

export type MockDashboardProfile = {
  id: string
  display_name: string
  avatar_url: string
}

export type MockDashboardPoint = {
  id: number
  organization_id: number
  name: string
  notes: string
  status: "active" | "inactive"
  membersCount: number
  tracksCount: number
  memberIds: string[]
}

export type MockDashboardFixture = {
  organizations: MockDashboardOrganization[]
  organizationMemberIdsByOrganization: Record<number, string[]>
  pointsByOrganization: Record<number, MockDashboardPoint[]>
  profilesById: Record<string, MockDashboardProfile>
}

const FIRST_NAMES = [
  "Noam",
  "Yael",
  "Daniel",
  "Maya",
  "Omer",
  "Lior",
  "Tamar",
  "Eitan",
  "Neta",
  "Amit",
  "Shir",
  "Yuval",
  "Ron",
  "Ella",
  "Itay",
  "Hila",
  "Gal",
  "Roni",
  "Tom",
  "Adi",
]

const LAST_NAMES = [
  "Levi",
  "Cohen",
  "Mizrahi",
  "Peretz",
  "Biton",
  "Azoulay",
  "Shahar",
  "Barak",
  "Dayan",
  "Mor",
  "Atias",
  "Aviv",
  "Harel",
  "Sharabi",
  "Ben-David",
  "Friedman",
  "Nahum",
  "Katz",
  "Sharon",
  "Nissani",
]

const ORGANIZATIONS: MockDashboardOrganization[] = [
  {
    id: 9101,
    name: "Companion Mobility",
    notes: "Organization-scale load preview with a large active member base and multiple service points.",
    status: "active",
  },
  {
    id: 9102,
    name: "Companion Field Support",
    notes: "Secondary organization for switching-state checks under heavier member counts.",
    status: "active",
  },
]

const ORGANIZATION_POINT_NAMES: Record<number, string[]> = {
  9101: [
    "Dizengoff Service Center",
    "Ayalon Service Center",
    "Haifa Service Hub",
    "Jerusalem Service Hub",
    "Beer Sheva Service Hub",
    "Petah Tikva Service Lab",
    "Raanana Service Lab",
    "Ashdod Service Lab",
    "Modiin Service Desk",
    "Rishon Service Desk",
  ],
  9102: [
    "North District Support",
    "Central District Support",
    "South District Support",
    "On-Site Repairs Team",
    "Logistics and Parts Team",
    "Quality Assurance Team",
  ],
}

function getAvatarUrl(index: number) {
  const portraitIndex = (index % 70) + 1
  return `https://i.pravatar.cc/80?img=${portraitIndex}`
}

function buildOrganizationMembers(
  organizationId: number,
  count: number,
  offset: number
) {
  const memberIds: string[] = []
  const profilesById: Record<string, MockDashboardProfile> = {}

  for (let index = 0; index < count; index += 1) {
    const memberNumber = offset + index
    const userId = `mock-org-${organizationId}-user-${String(index + 1).padStart(3, "0")}`
    const display_name = `${FIRST_NAMES[memberNumber % FIRST_NAMES.length]} ${
      LAST_NAMES[(memberNumber * 3) % LAST_NAMES.length]
    }`

    memberIds.push(userId)
    profilesById[userId] = {
      id: userId,
      display_name,
      avatar_url: getAvatarUrl(memberNumber),
    }
  }

  return { memberIds, profilesById }
}

function buildPointMembers(
  memberIds: string[],
  pointIndex: number,
  desiredSize: number
) {
  return [...memberIds]
    .map((memberId, index) => ({
      memberId,
      score: (index * (pointIndex + 7) + pointIndex * 19) % (memberIds.length + 17),
    }))
    .sort((left, right) => left.score - right.score)
    .slice(0, desiredSize)
    .map((entry) => entry.memberId)
}

function buildPointsForOrganization(
  organization: MockDashboardOrganization,
  memberIds: string[]
) {
  const pointNames = ORGANIZATION_POINT_NAMES[organization.id] ?? []

  return pointNames.map((name, pointIndex) => {
    const memberTarget = Math.min(
      memberIds.length,
      22 + (pointIndex % 5) * 11 + pointIndex * 2
    )

    return {
      id: organization.id * 100 + pointIndex + 1,
      organization_id: organization.id,
      name,
      notes: `Operational point ${pointIndex + 1} for ${organization.name}, used to preview denser member and track states.`,
      status: pointIndex % 7 === 0 ? "inactive" : "active",
      membersCount: memberTarget,
      tracksCount: 14 + (pointIndex % 6) * 5 + pointIndex,
      memberIds: buildPointMembers(memberIds, pointIndex, memberTarget),
    } satisfies MockDashboardPoint
  })
}

function createFixture(): MockDashboardFixture {
  const firstOrgMembers = buildOrganizationMembers(9101, 240, 0)
  const secondOrgMembers = buildOrganizationMembers(9102, 180, 300)

  const profilesById = {
    ...firstOrgMembers.profilesById,
    ...secondOrgMembers.profilesById,
  }

  return {
    organizations: ORGANIZATIONS,
    organizationMemberIdsByOrganization: {
      9101: firstOrgMembers.memberIds,
      9102: secondOrgMembers.memberIds,
    },
    pointsByOrganization: {
      9101: buildPointsForOrganization(ORGANIZATIONS[0], firstOrgMembers.memberIds),
      9102: buildPointsForOrganization(ORGANIZATIONS[1], secondOrgMembers.memberIds),
    },
    profilesById,
  }
}

export const dashboardLoadFixture = createFixture()

export function isDashboardMockMode(search: string) {
  const params = new URLSearchParams(search)
  return (
    params.get("mockMembers") === "1" ||
    import.meta.env.VITE_DASHBOARD_LOAD_MOCK === "true"
  )
}
