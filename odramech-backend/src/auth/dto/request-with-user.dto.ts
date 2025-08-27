import { Request } from 'express';
import { LoggedUser } from './logged-user.dto';

export class RequestWithUser extends Request {
    user: LoggedUser
}