import { Component } from '@theme/component';
import { debounce, onDocumentLoaded } from '@theme/utilities';
import { MegaMenuHoverEvent } from '@theme/events';

const ACTIVATE_DELAY = 0;
const DEACTIVATE_DELAY = 350;

/**
 * A custom element that manages a header menu.
 *
 * @typedef {Object} State
 * @property {HTMLElement | null} activeItem - The currently active menu item.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} overflowMenu - The overflow menu.
 * @property {HTMLElement[]} [submenu] - The submenu in each respective menu item.
 *
 * @extends {Component<Refs>}
 */
class HeaderMenu extends Component {
  requiredRefs = ['overflowMenu'];

  #abortController = new AbortController();

  /**
   * Track currently opened nested submenu so we can reposition on scroll/resize
   * @type {{ link: HTMLElement, list: HTMLElement } | null}
   */
  #openNested = null;

  /**
   * Position the open nested submenu relative to its parent item and keep it in viewport
   */
  #positionOpenNested = () => {
    if (!this.#openNested) return;
    const { link, list } = this.#openNested;

    const parentListItem = link.closest('li');
    const rect = parentListItem?.getBoundingClientRect();
    if (!rect) return;

    // Ensure the element is visible for measurement
    list.style.visibility = 'hidden';
    list.style.display = 'block';
    const nestedWidth = Math.max(list.offsetWidth || 0, parseInt(list.style.minWidth || '0', 10) || 0, 220);
    const nestedHeight = list.offsetHeight || 0;
    list.style.display = '';
    list.style.visibility = '';

    let left = Math.round(rect.right);
    let top = Math.round(rect.top);

    const margin = 8;
    // Flip to left if overflowing viewport on the right
    if (left + nestedWidth + margin > window.innerWidth) {
      left = Math.max(margin, Math.round(rect.left - nestedWidth));
    }

    // Clamp vertically to viewport
    const maxTop = Math.max(margin, window.innerHeight - nestedHeight - margin);
    top = Math.min(Math.max(top, margin), maxTop);

    list.style.position = 'fixed';
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
    list.style.minWidth = `${nestedWidth}px`;
    list.style.zIndex = '9999';
    const maxH = Math.max(200, window.innerHeight - 2 * margin);
    list.style.maxHeight = `${maxH}px`;
    list.style.overflow = 'auto';
  };

  connectedCallback() {
    super.connectedCallback();

    this.overflowMenu?.addEventListener('pointerleave', () => this.#debouncedDeactivate(), {
      signal: this.#abortController.signal,
    });

    // Add hover listeners to submenus to prevent deactivation
    this.addEventListener('pointerenter', (event) => {
      if (event.target.closest('.menu-list__submenu')) {
        this.#debouncedDeactivate.cancel();
      }
    }, { signal: this.#abortController.signal });

    this.addEventListener('pointerleave', (event) => {
      if (event.target.closest('.menu-list__submenu')) {
        this.#debouncedDeactivate();
      }
    }, { signal: this.#abortController.signal });

    // Add click handlers for submenu toggles
    this.addEventListener('click', (event) => {
      const link = event.target.closest('.menu-list__link--has-submenu');
      if (link) {
        event.preventDefault();
        const submenu = link.parentElement.querySelector('.menu-list__submenu');
        const isExpanded = link.getAttribute('aria-expanded') === 'true';
        
        // Toggle aria-expanded
        link.setAttribute('aria-expanded', !isExpanded);
        
        // Toggle submenu visibility
        if (submenu) {
          if (isExpanded) {
            submenu.setAttribute('hidden', '');
          } else {
            submenu.removeAttribute('hidden');
          }
        }
      }
    }, { signal: this.#abortController.signal });

    // Add click handlers for nested mega menu parent links
    this.addEventListener('click', (event) => {
      const nestedParent = event.target.closest('.mega-menu__link--parent');
      if (!nestedParent) return;

      const controlsId = nestedParent.getAttribute('aria-controls');
      if (!controlsId) return;

      const nestedList = this.querySelector(`#${CSS.escape(controlsId)}`);
      if (!nestedList) return;

      event.preventDefault();
      event.stopPropagation();

      const isExpanded = nestedParent.getAttribute('aria-expanded') === 'true';
      nestedParent.setAttribute('aria-expanded', (!isExpanded).toString());
      if (isExpanded) {
        nestedList.setAttribute('hidden', '');
        // Clear positioning when closing
        nestedList.style.position = '';
        nestedList.style.top = '';
        nestedList.style.left = '';
        nestedList.style.minWidth = '';
        nestedList.style.zIndex = '';
        nestedList.style.maxHeight = '';
        nestedList.style.overflow = '';
        this.#openNested = null;
      } else {
        nestedList.removeAttribute('hidden');
        this.#openNested = { link: nestedParent, list: nestedList };
        this.#positionOpenNested();
      }
    }, { signal: this.#abortController.signal });

    onDocumentLoaded(this.#preloadImages);

    // Reposition nested submenu on scroll and resize so it stays anchored
    window.addEventListener('scroll', this.#positionOpenNested, { passive: true, signal: this.#abortController.signal });
    window.addEventListener('resize', this.#positionOpenNested, { passive: true, signal: this.#abortController.signal });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#abortController.abort();
  }

  /**
   * @type {State}
   */
  #state = {
    activeItem: null,
  };

  /**
   * Time to allow for a closing animation between initiating a deactivation and actually deactivating the active item.
   * @returns {number}
   */
  get animationDelay() {
    const value = this.dataset.animationDelay;
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Get the overflow menu
   */
  get overflowMenu() {
    return /** @type {HTMLElement | null} */ (this.refs.overflowMenu?.shadowRoot?.querySelector('[part="overflow"]'));
  }

  /**
   * Whether the overflow menu is hovered
   * @returns {boolean}
   */
  get overflowHovered() {
    return this.refs.overflowMenu?.matches(':hover') ?? false;
  }

  /**
   * Activate the selected menu item immediately
   * @param {PointerEvent | FocusEvent} event
   */
  activate = (event) => {
    this.#debouncedDeactivate.cancel();
    this.#debouncedActivateHandler.cancel();

    this.#debouncedActivateHandler(event);
  };

  /**
   * Activate the selected menu item with a delay
   * @param {PointerEvent | FocusEvent} event
   */
  #activateHandler = (event) => {
    this.#debouncedDeactivate.cancel();

    this.dispatchEvent(new MegaMenuHoverEvent());

    this.removeAttribute('data-animating');

    if (!(event.target instanceof Element)) return;

    let item = findMenuItem(event.target);

    if (!item || item == this.#state.activeItem) return;

    const isDefaultSlot = event.target.slot === '';

    this.dataset.overflowExpanded = (!isDefaultSlot).toString();

    const previouslyActiveItem = this.#state.activeItem;

    if (previouslyActiveItem) {
      previouslyActiveItem.ariaExpanded = 'false';
    }

    this.#state.activeItem = item;
    this.ariaExpanded = 'true';
    item.ariaExpanded = 'true';

    let submenu = findSubmenu(item);
    let overflowMenuHeight = this.overflowMenu?.offsetHeight ?? 0;

    if (!submenu && !isDefaultSlot) {
      submenu = this.overflowMenu;
    }

    const submenuHeight = submenu ? Math.max(submenu.offsetHeight, overflowMenuHeight) : 0;

    this.style.setProperty('--submenu-height', `${submenuHeight}px`);
    this.style.setProperty('--submenu-opacity', '1');
  };

  #debouncedActivateHandler = debounce(this.#activateHandler, ACTIVATE_DELAY);

  /**
   * Deactivate the active item after a delay
   * @param {PointerEvent | FocusEvent} event
   */
  deactivate(event) {
    this.#debouncedActivateHandler.cancel();

    if (!(event.target instanceof Element)) return;

    const item = findMenuItem(event.target);
    const submenu = findSubmenu(item);
    const related = /** @type {Element | null} */ (event.relatedTarget instanceof Element ? event.relatedTarget : null);

    // Don't deactivate if hovering over the submenu or any nested submenu
    if (
      (submenu && related && submenu.contains(related)) ||
      (related && related.closest('.mega-menu__nested'))
    ) {
      return;
    }

    // Make sure the item to be deactivated is still the active one. Ideally
    // we cancelled the debounce before the item was changed, but just in case.
    if (item === this.#state.activeItem) {
      this.#debouncedDeactivate();
    }
  }

  /**
   * Deactivate the active item immediately
   * @param {HTMLElement | null} [item]
   */
  #deactivate = (item = this.#state.activeItem) => {
    if (!item || item != this.#state.activeItem) return;
    if (this.overflowHovered) return;

    this.style.setProperty('--submenu-height', '0px');
    this.style.setProperty('--submenu-opacity', '0');
    this.dataset.overflowExpanded = 'false';

    this.#state.activeItem = null;
    this.ariaExpanded = 'false';
    item.ariaExpanded = 'false';
    item.setAttribute('data-animating', '');

    setTimeout(() => {
      item.removeAttribute('data-animating');
    }, Math.max(0, this.animationDelay - 150)); // Start header transition 150ms before submenu finishes
  };

  /**
   * Deactivate the active item after a delay
   * @param {PointerEvent | FocusEvent} event
   */
  #debouncedDeactivate = debounce(this.#deactivate, DEACTIVATE_DELAY);

  /**
   * Preload images that are set to load lazily.
   */
  #preloadImages = () => {
    const images = this.querySelectorAll('img[loading="lazy"]');
    images?.forEach((image) => image.removeAttribute('loading'));
  };
}

if (!customElements.get('header-menu')) {
  customElements.define('header-menu', HeaderMenu);
}

/**
 * Find the closest menu item.
 * @param {Element | null | undefined} element
 * @returns {HTMLElement | null}
 */
function findMenuItem(element) {
  if (!(element instanceof Element)) return null;

  if (element?.matches('[slot="more"')) {
    // Select the first overflowing menu item when hovering over the "More" item
    return findMenuItem(element.parentElement?.querySelector('[slot="overflow"]'));
  }

  return element?.querySelector('[ref="menuitem"]');
}

/**
 * Find the closest submenu.
 * @param {Element | null | undefined} element
 * @returns {HTMLElement | null}
 */
function findSubmenu(element) {
  const submenu = element?.parentElement?.querySelector('[ref="submenu[]"]');
  return submenu instanceof HTMLElement ? submenu : null;
}
