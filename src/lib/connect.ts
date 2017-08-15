import { Server, ServerRequest, ServerResponse } from 'http';
import * as finalhandler from 'finalhandler';
import { Core } from './core';
import { ListenOptions, ErrorReason } from './define';

export class Connect extends Core {

  protected _server: Server;

  public get server() {
    if (!this._server) this._server = new Server(this.handleRequest.bind(this));
    return this._server;
  }

  public listen(options: ListenOptions, listeningListener?: () => void) {
    this.server.listen(options, listeningListener);
  }

  public attach(server: Server) {
    server.on('request', this.handleRequest.bind(this));
  }

  public handleRequest(req: ServerRequest, res: ServerResponse, done?: (err?: ErrorReason) => void) {
    this.handleRequestByRequestResponse(req, res, done || finalhandler(req, res));
  }

}
