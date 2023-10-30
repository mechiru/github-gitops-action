import {Member, MemberRole, Team, TeamPrivacy, parseYaml} from 'src/config';
import {ConfigAccessor} from 'src/config_accessor';

describe('config_accessor.ts', () => {
  it('ConfigAccessor.listMembers', () => {
    const cases: {in: string; want: Map<string, Member>}[] = [
      {
        in: `
members:
- login: hoge
  email: hoge@mail.com
  role: admin
`,
        want: (() => {
          const map = new Map<string, Member>();
          map.set('hoge', {login: 'hoge', email: 'hoge@mail.com', role: 'admin'});
          return map;
        })(),
      },
      {
        in: `
members:
- login: foo
  email: foo@mail.com
  role: admin
- login: bar
  email: bar@mail.com
  role: member
  meta:
    some-service: someid
- login: hoge
  email: hoge@mail.com
  role: member
`,
        want: (() => {
          const map = new Map<string, Member>();
          map.set('foo', {login: 'foo', email: 'foo@mail.com', role: MemberRole.admin});
          map.set('bar', {
            login: 'bar',
            email: 'bar@mail.com',
            role: MemberRole.member,
            meta: {'some-service': 'someid'},
          });
          map.set('hoge', {login: 'hoge', email: 'hoge@mail.com', role: MemberRole.member});
          return map;
        })(),
      },
    ];

    for (const c of cases) {
      const ca = new ConfigAccessor(parseYaml(c.in));
      expect(ca.listMember()).toEqual(c.want);
    }
  });

  it('ConfigAccessor.listTeams', () => {
    const cases: {in: string; want: Map<string, Team>}[] = [
      {
        in: `
members:

teams:
- name: abc
  visibility: closed
`,
        want: (() => {
          const map = new Map<string, Team>();
          map.set('abc', {name: 'abc', visibility: TeamPrivacy.closed});
          return map;
        })(),
      },
      {
        in: `
members:

teams:
- name: abc
  visibility: closed
- name: def
  visibility: secret
- name: ghi
  visibility: secret
`,
        want: (() => {
          const map = new Map<string, Team>();
          map.set('abc', {name: 'abc', visibility: TeamPrivacy.closed});
          map.set('def', {name: 'def', visibility: TeamPrivacy.secret});
          map.set('ghi', {name: 'ghi', visibility: TeamPrivacy.secret});
          return map;
        })(),
      },
    ];

    for (const c of cases) {
      const ca = new ConfigAccessor(parseYaml(c.in));
      expect(ca.listTeam()).toEqual(c.want);
    }
  });
});
