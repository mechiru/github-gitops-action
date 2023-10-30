import {diff} from 'src/sync_service';

describe('sync_service.ts', () => {
  it('diff', () => {
    type User = {login: string; email?: string};

    const cases: {
      in: Parameters<typeof diff<string, User, User>>;
      want: ReturnType<typeof diff<string, User, User>>;
    }[] = [
      {
        in: [new Map(), [], c => c.login, (d, c) => d.login === c.login],
        want: {add: [], sub: [], eq: [], notEq: []},
      },
      {
        in: [
          (() => {
            const map = new Map<string, User>();
            map.set('user1', {login: 'user1', email: 'user1@email.com'});
            map.set('user2', {login: 'user2'});
            map.set('user4', {login: 'user4', email: 'user4@email.com'});
            return map;
          })(),
          [{login: 'user1', email: 'user1@email.com'}, {login: 'user3'}, {login: 'user4'}],
          c => c.login,
          (d, c) => d.login === c.login && d?.email === c?.email,
        ],
        want: {
          add: [{login: 'user2'}],
          sub: [{login: 'user3'}],
          eq: [
            [
              {login: 'user1', email: 'user1@email.com'},
              {login: 'user1', email: 'user1@email.com'},
            ],
          ],
          notEq: [[{login: 'user4', email: 'user4@email.com'}, {login: 'user4'}]],
        },
      },
    ];

    for (const c of cases) {
      expect(diff(...c.in)).toEqual(c.want);
    }
  });
});
