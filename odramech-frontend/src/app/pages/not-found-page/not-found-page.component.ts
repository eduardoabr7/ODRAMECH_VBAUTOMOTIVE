import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [CommonModule],
  templateUrl: './not-found-page.component.html',
  styleUrl: './not-found-page.component.scss'
})
export class NotFoundPageComponent implements OnInit, OnDestroy {

  countdown = 5;
  private interval: any;

  constructor(private readonly _router: Router) {}

  ngOnInit(): void {
    this.interval = setInterval(() => {
      this.countdown--;
      if (this.countdown === 0) this.goHome();
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  goHome(): void {
    clearInterval(this.interval);
    this._router.navigateByUrl('/home');
  }
}