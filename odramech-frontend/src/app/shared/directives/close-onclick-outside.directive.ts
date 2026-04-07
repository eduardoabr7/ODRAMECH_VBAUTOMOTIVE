import { Directive, ElementRef, EventEmitter, HostListener, Output } from '@angular/core';

@Directive({
  selector: '[closeOnClickOutside]',
  standalone: true,
})
export class CloseOnClickOutsideDirective {
  @Output() clickOutside = new EventEmitter<void>();

  constructor(private el: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  onClick(target: HTMLElement): void {
    if (!this.el.nativeElement.contains(target)) {
      this.clickOutside.emit();
    }
  }
}