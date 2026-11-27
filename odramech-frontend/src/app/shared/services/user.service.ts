import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { UserCreate } from "@shared/models/UserCreate";
import { NestAPI } from "./nest-api.service";
import { QueryParams } from "../../core/http/query-params.builder";
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

    /** establishmentId: abre a ficha em outro estabelecimento onde quem pede é da equipe */
    getById(id: number, establishmentId?: number | null): Observable<UserDetail> {
      return this._nestApi.get(QueryParams.create().set('establishmentId', establishmentId).appendTo(`user/${id}`));
    }

    update(id: number, data: Partial<UserCreate> & { active?: boolean }, establishmentId?: number | null): Observable<UserDetail> {
      return this._nestApi.put(QueryParams.create().set('establishmentId', establishmentId).appendTo(`user/${id}`), data);
    }

}
