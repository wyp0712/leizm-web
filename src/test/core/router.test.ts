/**
 * @leizm/web 中间件基础框架 - 单元测试
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import { expect } from "chai";
import { Application, Router, Context, ErrorReason } from "../../lib";
import * as request from "supertest";

const METHODS = ["get", "head", "post", "put", "delete", "connect", "options", "trace", "patch"];

describe("Router", function() {
  it("可以在 Application.use 中直接使用", function(done) {
    const app = new Application();
    const router = new Router();
    router.post("/ok", function(ctx) {
      ctx.response.end("yes");
    });
    app.use("/", router);
    request(app.server)
      .post("/ok")
      .expect(200)
      .expect("yes", done);
  });

  it("可以通过 Router.use 嵌套 Router", function(done) {
    const status: any = {};
    const app = new Application();
    const router = new Router();
    const router2 = new Router();
    router2.post("/haha", function(ctx) {
      status.a = true;
      ctx.next();
    });
    router.use("/", router2);
    router.get("/haha", function(ctx) {
      status.b = true;
      ctx.next();
    });
    app.use("/", router);
    app.use("/", function(ctx) {
      ctx.response.end("ok");
    });
    request(app.server)
      .post("/haha")
      .expect(200)
      .expect("ok", function() {
        expect(status).to.deep.equal({
          a: true,
        });
        done();
      });
  });

  it("可拦截出错信息，并响应200", function(done) {
    const app = new Application();
    const router = new Router();
    router.get(
      "/xx",
      function(ctx) {
        throw new Error("test error");
      },
      function(ctx, err) {
        expect(err).to.instanceof(Error);
        expect(err)
          .property("message")
          .to.equal("test error");
        ctx.response.end("ok");
      },
      function(ctx, err) {
        throw new Error("不可能执行到此处");
      },
    );
    app.use("/", router);
    request(app.server)
      .get("/xx")
      .expect(200)
      .expect("ok", done);
  });

  it("all 响应所有请求", async function() {
    const app = new Application();
    const router = new Router();
    router.get("/", function(ctx) {
      ctx.response.end("不应该执行到此处");
    });
    router.all("/ok", function(ctx) {
      ctx.response.end("yes");
    });
    app.use("/", router);
    for (const method of METHODS) {
      if (method === "connect") continue;
      await (request(app.server) as any)
        [method]("/ok")
        .expect(200)
        .expect(method === "head" ? undefined : "yes");
    }
  });

  it("注册各种请求方法并正确处理请求", async function() {
    const app = new Application();
    const router = new Router();
    function generateHandle(msg: string) {
      return function(ctx: Context) {
        ctx.response.end(msg);
      };
    }
    function generateErrorHandle(msg: string) {
      return function(ctx: Context, err?: ErrorReason) {
        ctx.response.end(msg);
      };
    }
    for (const method of METHODS) {
      (router as any)[method]("/xyz", generateErrorHandle("不可能执行到此处"), generateHandle(`this is not ${method}`));
    }
    for (const method of METHODS) {
      (router as any)[method]("/abc", generateErrorHandle("不可能执行到此处"), generateHandle(`this is ${method}`));
    }
    app.use("/", router);
    for (const method of METHODS) {
      if (method === "connect") continue;
      await (request(app.server) as any)
        [method]("/abc")
        .expect(200)
        .expect(method === "head" ? undefined : `this is ${method}`);
    }
  });

  it("注册各种请求方法并正确处理出错的请求 (async function)", async function() {
    const app = new Application();
    const router = new Router();
    function generateHandle(msg: string) {
      return function(ctx: Context) {
        ctx.response.end(msg);
      };
    }
    function generateErrorHandle(msg: string) {
      return function(ctx: Context, err?: ErrorReason) {
        expect(err).to.instanceof(Error);
        expect(err)
          .property("message")
          .to.equal(msg);
        ctx.response.end(msg);
      };
    }
    for (const method of METHODS) {
      (router as any)[method]("/xyz", generateErrorHandle("不可能执行到此处"), generateHandle(method));
    }
    for (const method of METHODS) {
      (router as any)[method]("/abc", generateErrorHandle("不可能执行到此处"), generateHandle(method));
    }
    app.use("/", router);
    for (const method of METHODS) {
      if (method === "connect") continue;
      await (request(app.server) as any)
        [method]("/abc")
        .expect(200)
        .expect(method === "head" ? undefined : method);
    }
  });

  it("use() 的中间件始终在 get()、post() 等方法前面", async function() {
    const app = new Application();
    const router = new Router();
    const numbers: number[] = [];
    router.post("/ok", function(ctx) {
      ctx.response.end("yes");
    });
    router.post("/not_ok", function(ctx) {
      ctx.response.end("no");
    });
    router.use("/", function(ctx) {
      numbers.push(123);
      ctx.next();
    });
    router.use("/", function(ctx) {
      numbers.push(456);
      ctx.next();
    });
    router.get("/", function(ctx) {
      ctx.response.end("home");
    });
    app.use("/", router);

    await request(app.server)
      .post("/ok")
      .expect(200)
      .expect("yes");
    expect(numbers).to.deep.equal([123, 456]);

    await request(app.server)
      .post("/not_ok")
      .expect(200)
      .expect("no");
    expect(numbers).to.deep.equal([123, 456, 123, 456]);

    await request(app.server)
      .get("/")
      .expect(200)
      .expect("home");
    expect(numbers).to.deep.equal([123, 456, 123, 456, 123, 456]);
  });

  it("ctx.route 获得原始路由信息", async function() {
    const app = new Application();
    const router = new Router();
    const router2 = new Router();
    const router3 = new Router();
    const histories: any[] = [];
    app.use("/", function(ctx) {
      // console.log(ctx.route);
      histories.push(ctx.route);
      ctx.next();
    });
    app.use("/", router);
    app.use("/test", router2);
    app.use("/", function(ctx, err) {
      expect(err).instanceof(Error);
      expect((err as any).message).to.equal("xxxx");
      histories.push(ctx.route);
      ctx.response.json(ctx.route);
    });
    router2.use("/test3", router3);

    router.post("/ok", function(ctx) {
      const route = { method: "POST", path: "/ok" };
      expect(ctx.route).to.deep.equal(route);
      ctx.response.json(ctx.route);
    });
    router.get("/say/:msg", function(ctx) {
      const route = { method: "GET", path: "/say/:msg" };
      expect(ctx.route).to.deep.equal(route);
      ctx.response.json(ctx.route);
    });
    router.get("/error/:msg", function(ctx) {
      const route = { method: "GET", path: "/error/:msg" };
      expect(ctx.route).to.deep.equal(route);
      ctx.next(new Error(ctx.request.params.msg));
    });

    router2.all("/user/:user_id/reply/:info", function(ctx) {
      const route = { method: "ALL", path: "/test/user/:user_id/reply/:info" };
      expect(ctx.route).to.deep.equal(route);
      ctx.response.json(ctx.route);
    });

    router3.all("/hahaha/:name", function(ctx) {
      const route = { method: "ALL", path: "/test/test3/hahaha/:name" };
      expect(ctx.route).to.deep.equal(route);
      ctx.response.json(ctx.route);
    });

    await request(app.server)
      .post("/ok")
      .expect(200)
      .expect({ method: "POST", path: "/ok" });
    await request(app.server)
      .get("/say/hello")
      .expect(200)
      .expect({ method: "GET", path: "/say/:msg" });
    await request(app.server)
      .get("/say/hi")
      .expect(200)
      .expect({ method: "GET", path: "/say/:msg" });
    await request(app.server)
      .delete("/test/user/123/reply/abc")
      .expect(200)
      .expect({ method: "ALL", path: "/test/user/:user_id/reply/:info" });
    await request(app.server)
      .delete("/test/test3/hahaha/abc")
      .expect(200)
      .expect({ method: "ALL", path: "/test/test3/hahaha/:name" });
    await request(app.server)
      .get("/error/xxxx")
      .expect(200)
      .expect({ method: "GET", path: "/error/:msg" });
    expect(histories).to.deep.equal([
      { method: "POST", path: "/ok" },
      { method: "GET", path: "/say/hello" },
      { method: "GET", path: "/say/hi" },
      { method: "DELETE", path: "/test/user/123/reply/abc" },
      { method: "DELETE", path: "/test/test3/hahaha/abc" },
      { method: "GET", path: "/error/xxxx" },
      { method: "GET", path: "/error/:msg" },
    ]);
  });
});
