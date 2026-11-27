import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { UserCreate } from "@shared/models/UserCreate";
import { NestAPI } from "./nest-api.service";
import { UserDetail, UserList } from "@shared/models/UserList";
import { WorkerCreate } from "@shared/models/WorkerCreate";

@Injectable({
  providedIn: 'root'
})
export class UserService {
    constructor(
        private readonly _nestApi: NestAPI
    ) {}

    create(data: UserCreate): Observable<any> {
        return this._nestApi.post('user/create', data)
    }

    createWorker(data: WorkerCreate): Observable<any> {
        return this._nestApi.post('user/create-worker', data)
    }

    search(term: string): Observable<UserList[]> {
      return this._nestApi.get(`user/search?term=${encodeURIComponent(term)}`);
    }

    getById(id: number): Observable<UserDetail> {
      return this._nestApi.get(`user/${id}`);
    }

    update(id: number, data: Partial<UserCreate>): Observable<UserDetail> {
      return this._nestApi.put(`user/${id}`, data);
    }

}
