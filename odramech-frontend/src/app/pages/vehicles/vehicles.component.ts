import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription, switchMap, tap } from 'rxjs';
import { VehicleService } from '@shared/services/vehicle.service';
import { SessionService } from '@shared/services/session.service';
import { VehicleListItem } from '@shared/models/Vehicle';
import { StatusBadgeComponent } from '@shared/ui/status-badge.component';
import { PlatePipe } from "@shared/ui/pipes";

@Component({
  selector: 'app-vehicles',
  imports: [CommonModule, FormsModule, RouterModule, StatusBadgeComponent, PlatePipe],
  templateUrl: './vehicles.component.html',
  styleUrl: './vehicles.component.scss',
})
export class VehiclesComponent implements OnInit, OnDestroy {

  vehicles: VehicleListItem[] = [];
  loading = true;
  search = '';
  view: 'grid' | 'list' = 'grid';

  private readonly search$ = new Subject<string>();
  private readonly subs = new Subscription();

  constructor(
    private readonly _vehicles: VehicleService,
    private readonly _router: Router,
    readonly session: SessionService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      tap(() => this.loading = true),
      switchMap(term => this._vehicles.list(term)),
    ).subscribe({
      next: list => { this.vehicles = list; this.loading = false; },
      error: () => { this.loading = false; },
    }));
    this.search$.next('');
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  onSearch(v: string): void { this.search$.next(v); }

  openOwner(v: VehicleListItem): void {
    const owner = v.owners[0];
    if (owner) this._router.navigate(['/clients', owner.id]);
  }

  openLast(v: VehicleListItem, e: Event): void {
    e.stopPropagation();
    if (v.lastWorkOrder) this._router.navigate(['/orders', v.lastWorkOrder.id]);
  }
}
