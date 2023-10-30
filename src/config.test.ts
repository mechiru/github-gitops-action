import {Config, MemberRole, parseYaml, readConfigFile} from 'src/config';

describe('config.ts', () => {
  it('parseYaml', () => {
    const cases: {in: string; want: Config}[] = [
      {
        in: `
members:
- login: hoge
  email: hoge@mail.com
  role: admin
`,
        want: {
          members: [{login: 'hoge', email: 'hoge@mail.com', role: MemberRole.admin}],
        },
      },
    ];

    for (const c of cases) {
      expect(parseYaml(c.in)).toEqual(c.want);
    }
  });

  it('readConfigFile', async () => {
    const cases: {in: string; want: Config}[] = [
      {
        in: 'src/testdata/sample.yml',
        want: {
          members: [
            {login: 'foo', email: 'foo@mail.com', role: MemberRole.admin},
            {login: 'bar', email: 'bar@mail.com', role: MemberRole.member, meta: {'some-service': 'someid'}},
            {login: 'hoge', email: 'hoge@mail.com', role: MemberRole.member},
          ],
        },
      },
    ];

    for (const c of cases) {
      expect(await readConfigFile(c.in)).toEqual(c.want);
    }
  });
});
