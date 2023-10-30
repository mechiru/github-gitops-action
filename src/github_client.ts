import {MemberRole, RepositoryVisibility, TeamPrivacy, RepositoryPermission} from 'src/config';

export interface GitHubClient {
  listOrganizationMember(): Promise<Member[]>;
  addOrganizationMember(input: AddMember): Promise<void>;
  updateOrganizationMember(input: UpdateMember): Promise<void>;
  removeOrganizationMember(input: RemoveMember): Promise<void>;

  listOrganizationRepository(input: ListRepository): Promise<Repository[]>;
  createOrganizationRepository(input: CreateRepository): Promise<void>;
  updateOrganizationRepository(input: UpdateRepository): Promise<void>;
  deleteOrganizationRepository(input: DeleteRepository): Promise<void>;

  addRepositoryCollaborator(input: AddCollaborator): Promise<void>;
  updateRepositoryCollaborator(input: UpdateCollaborator): Promise<void>;
  removeRepositoryCollaborator(input: RemoveCollaborator): Promise<void>;

  listTeam(): Promise<Team[]>;
  createTeam(input: CreateTeam): Promise<void>;
  updateTeam(input: UpdateTeam): Promise<void>;
  deleteTeam(input: DeleteTeam): Promise<void>;

  listTeamRepository(input: ListTeamRepository): Promise<TeamRepository[]>;
  addTeamRepository(input: AddTeamRepository): Promise<void>;
  updateTeamRepository(input: UpdateTeamRepository): Promise<void>;
  removeTeamRepository(input: RemoveTeamRepository): Promise<void>;

  listTeamMember(input: ListTeamMember): Promise<TeamMember[]>;
  addTeamMember(input: AddTeamMember): Promise<void>;
  removeTeamMember(input: RemoveTeamMember): Promise<void>;
}

export type Member = Readonly<{
  login: string;
  role: MemberRole;
}>;

export type AddMember = Member &
  Readonly<{
    email: string;
    teamIds: number[];
    role: MemberRole;
  }>;

export type UpdateMember = Member;

export type RemoveMember = Pick<Member, 'login'>;

export type Repository = Readonly<{
  id: number;
  name: string;
  description?: string;
  visibility: RepositoryVisibility;
  collaborators: Readonly<{
    login: string;
    permission: RepositoryPermission;
  }>[];
}>;

export type ListRepository = Readonly<{withCollaborator: boolean}>;

export type CreateRepository = Readonly<{
  name: string;
  description?: string;
  visibility: RepositoryVisibility;
}>;

export type UpdateRepository = CreateRepository;

export type DeleteRepository = Pick<CreateRepository, 'name'>;

export type AddCollaborator = Readonly<{
  repository: string;
  login: string;
  permission: RepositoryPermission;
}>;

export type UpdateCollaborator = AddCollaborator;

export type RemoveCollaborator = Omit<AddCollaborator, 'permission'>;

export type Team = Readonly<{
  id: number;
  slug: string;
  name: string;
  description?: string;
  privacy: TeamPrivacy;
  parent?: Readonly<{
    id: number;
    slug: string;
    name: string;
  }>;
}>;

export type CreateTeam = Readonly<{
  name: string;
  description?: string;
  privacy: TeamPrivacy;
  parentTeam?: number;
}>;

export type UpdateTeam = Readonly<{
  slug: string;
  name?: string;
  description?: string;
  privacy?: TeamPrivacy;
  parentTeam?: number;
}>;

export type DeleteTeam = Pick<UpdateTeam, 'slug'>;

export type TeamRepository = Readonly<{
  id: number;
  name: string;
  permission: RepositoryPermission;
}>;

export type ListTeamRepository = Readonly<{
  slug: string;
}>;

export type AddTeamRepository = RemoveTeamRepository &
  Readonly<{
    permission?: RepositoryPermission;
  }>;

export type UpdateTeamRepository = AddTeamRepository;

export type RemoveTeamRepository = ListTeamRepository &
  Readonly<{
    repository: string;
  }>;

export type TeamMember = Readonly<{
  login: string;
}>;

export type ListTeamMember = Readonly<{
  slug: string;
}>;

export type AddTeamMember = ListTeamMember &
  Readonly<{
    login: string;
  }>;

export type RemoveTeamMember = AddTeamMember;
