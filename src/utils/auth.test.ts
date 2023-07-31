import sinon from "sinon";
import { test } from "tap";

import { DateTime } from "luxon";
import { testNowDate, testUser1 } from "./testing/data";

// test objects

const nowFake = sinon.fake.returns(testNowDate);

// helpers

function importModule(test: Tap.Test) {
  return test.mock("./auth", {
    "../utils/time": { now: nowFake },
  });
}

// tests

test("utils/auth", async (t) => {
  t.test("capturePreAuthState", async (t) => {
    t.test("captured return_to query in session", async (t) => {
      const req: any = { query: { return_to: "/foo" } };

      const { capturePreAuthState } = importModule(t);
      capturePreAuthState(req);

      t.ok(req.session);
      t.equal(req.session.return_to, "/foo");
    });
  });

  t.test("beginSignup", async (t) => {
    t.test("saves registration state in session", async (t) => {
      const req: any = {};

      const { beginSignup } = importModule(t);
      beginSignup(req, "CHALLENGE!", { ...testUser1 });

      t.ok(req.session);
      const { registration } = req.session;
      t.ok(registration);
      t.same(registration.registeringUser, {
        id: testUser1.id,
        created: testUser1.created,
        username: testUser1.username,
        displayName: testUser1.displayName,
        isAdmin: false,
      });
      t.equal(registration.challenge, "CHALLENGE!");
    });
  });

  t.test("beginSignIn", async (t) => {
    t.test("saves authentication state in session", async (t) => {
      t.test("when existing user", async (t) => {
        const req: any = {};

        const { beginSignIn } = importModule(t);
        beginSignIn(req, "CHALLENGE!", { ...testUser1 }, "preferred");

        t.ok(req.session);
        const { authentication } = req.session;
        t.ok(authentication);
        t.same(authentication.authenticatingUser, testUser1);
        t.equal(authentication.challenge, "CHALLENGE!");
        t.equal(authentication.userVerification, "preferred");
      });

      t.test("when no existing user", async (t) => {
        const req: any = {};

        const { beginSignIn } = importModule(t);
        beginSignIn(req, "CHALLENGE!", undefined, "preferred");

        t.ok(req.session);
        const { authentication } = req.session;
        t.ok(authentication);
        t.notOk(authentication.authenticatingUser);
        t.equal(authentication.challenge, "CHALLENGE!");
        t.equal(authentication.userVerification, "preferred");
      });
    });
  });

  t.test("signIn", async (t) => {
    t.test("saves registered credential in session", async (t) => {
      const req: any = {};
      const credential: any = {};

      const { signIn } = importModule(t);
      signIn(req, credential);

      t.ok(req.session);
      const { authentication } = req.session;
      t.ok(authentication);
      t.equal(authentication.credential, credential);
      t.ok(authentication.time);
    });

    t.test("clears temp session values", async (t) => {
      const req: any = { registration: {}, return_to: "/foo" };
      const credential: any = {};

      const { signIn } = importModule(t);
      signIn(req, { ...testUser1 }, credential);

      t.ok(req.session);
      t.notOk(req.session.registration);
      t.notOk(req.session.return_to);
    });
  });

  t.test("signOut", async (t) => {
    t.test("clears the session", async (t) => {
      const req: any = { session: {} };

      const { signOut } = importModule(t);
      signOut(req);

      t.notOk(req.session);
    });
  });

  t.test("getReturnTo", async (t) => {
    t.test("returns expected value", async (t) => {
      const req: any = { session: { return_to: "/foo" } };

      const { getReturnTo } = importModule(t);
      const result = getReturnTo(req);

      t.equal(result, "/foo");
    });

    t.test("returns expected default", async (t) => {
      const req: any = {};

      const { getReturnTo } = importModule(t);
      const result = getReturnTo(req);

      t.equal(result, "/");
    });
  });

  t.test("getAuthentication", async (t) => {
    t.test("returns expected value", async (t) => {
      const authentication = {};
      const req: any = { session: { authentication } };

      const { getAuthentication } = importModule(t);
      const result = getAuthentication(req);

      t.equal(result, authentication);
    });

    t.test("returns expected default", async (t) => {
      const req: any = {};

      const { getAuthentication } = importModule(t);
      const result = getAuthentication(req);

      t.notOk(result);
    });
  });

  t.test("getRegistration", async (t) => {
    t.test("returns expected value", async (t) => {
      const registration = {};
      const req: any = { session: { registration } };

      const { getRegistration } = importModule(t);
      const result = getRegistration(req);

      t.equal(result, registration);
    });

    t.test("returns expected default", async (t) => {
      const req: any = {};

      const { getRegistration } = importModule(t);
      const result = getRegistration(req);

      t.notOk(result);
    });
  });

  t.test("auth", async (t) => {
    const user = {};
    const credential = { user };
    const res: any = {};

    t.test("sets expected req fields if user authenticated", async (t) => {
      const req: any = {
        session: {
          authentication: { time: DateTime.now().toMillis(), credential },
        },
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const { auth } = importModule(t);
      const middleware = auth();

      middleware(req, res, next);

      t.equal(req.user, user);
      t.equal(req.credential, credential);
      t.ok(nextCalled);
    });

    t.test(
      "does not set expected req fields if user not authenticated",
      async (t) => {
        const req: any = {};
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
        };

        const { auth } = importModule(t);
        const middleware = auth();

        middleware(req, res, next);

        t.same(req, {});
        t.ok(nextCalled);
      }
    );
  });

  t.test("requiresAuth", async (t) => {
    t.test(
      "redirects to login page if user is not authenticated",
      async (t) => {
        const req: any = { originalUrl: "/foo" };
        const res: any = {
          redirect: sinon.fake(),
        };
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
        };

        const { requiresAuth } = importModule(t);
        const middleware = requiresAuth();

        middleware(req, res, next);

        t.equal(res.redirect.firstCall.firstArg, "/login?return_to=%2Ffoo");
        t.notOk(nextCalled);
      }
    );

    t.test("does not redirect if user is not authenticated", async (t) => {
      const req: any = { user: {}, originalUrl: "/foo" };
      const res: any = {
        redirect: sinon.fake(),
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      const { requiresAuth } = importModule(t);
      const middleware = requiresAuth();

      middleware(req, res, next);

      t.notOk(res.redirect.called);
      t.ok(nextCalled);
    });
  });
});
