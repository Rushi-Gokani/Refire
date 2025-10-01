import { Component } from '@theme/component';
import { debounce, onDocumentLoaded } from '@theme/utilities';
import { MegaMenuHoverEvent } from '@theme/events';

const ACTIVATE_DELAY = 0;
const DEACTIVATE_DELAY = 350;
const NESTED_DEACTIVATE_DELAY = 250;

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

  // No scroll-based positioning needed

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
      } else {
        // Close any other open nested lists first
        this.querySelectorAll('.mega-menu__nested:not([hidden])')
          .forEach((openList) => {
            openList.setAttribute('hidden', '');
            const id = openList.getAttribute('id');
            if (id) {
              const openLink = this.querySelector(`[aria-controls="${CSS.escape(id)}"]`);
              if (openLink) openLink.setAttribute('aria-expanded', 'false');
            }
          });

        nestedList.removeAttribute('hidden');
        // Position nested submenu to the right of its parent item relative to the submenu container
        const container = nestedParent.closest('.menu-list__submenu-inner');
        const parentListItem = nestedParent.closest('li');
        if (container && parentListItem) {
          const containerRect = container.getBoundingClientRect();
          const parentRect = parentListItem.getBoundingClientRect();

          // Ensure positioning context for container
          if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
          }

          nestedList.style.position = 'absolute';
          nestedList.style.top = `${Math.max(0, parentRect.top - containerRect.top)}px`;
          nestedList.style.left = `${Math.max(0, parentRect.right - containerRect.left)}px`;
          nestedList.style.minWidth = `${Math.max(parentRect.width, 220)}px`;
          nestedList.style.zIndex = '2';
          nestedList.style.maxHeight = 'none';
          nestedList.style.overflow = 'visible';
        }
      }
    }, { signal: this.#abortController.signal });

    // Hover open for nested submenus
    this.addEventListener('pointerenter', (event) => {
      const nestedParent = event.target.closest('.mega-menu__link--parent');
      if (!nestedParent) return;

      const controlsId = nestedParent.getAttribute('aria-controls');
      if (!controlsId) return;
      const nestedList = this.querySelector(`#${CSS.escape(controlsId)}`);
      if (!nestedList) return;

      // Open and position
      nestedParent.setAttribute('aria-expanded', 'true');
      nestedList.removeAttribute('hidden');
      const container = nestedParent.closest('.menu-list__submenu-inner');
      const parentListItem = nestedParent.closest('li');
      if (container && parentListItem) {
        const containerRect = container.getBoundingClientRect();
        const parentRect = parentListItem.getBoundingClientRect();
        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
        nestedList.style.position = 'absolute';
        nestedList.style.top = `${Math.max(0, parentRect.top - containerRect.top)}px`;
        nestedList.style.left = `${Math.max(0, parentRect.right - containerRect.left)}px`;
        nestedList.style.minWidth = `${Math.max(parentRect.width, 220)}px`;
        nestedList.style.zIndex = '2';
        nestedList.style.maxHeight = 'none';
        nestedList.style.overflow = 'visible';
      }
    }, { signal: this.#abortController.signal });

    // Close nested submenu when cursor leaves both parent li and nested list
    let nestedCloseTimeout = null;
    const scheduleClose = () => {
      if (nestedCloseTimeout) clearTimeout(nestedCloseTimeout);
      nestedCloseTimeout = setTimeout(() => {
        this.querySelectorAll('.mega-menu__nested:not([hidden])').forEach((list) => {
          list.setAttribute('hidden', '');
          const id = list.getAttribute('id');
          if (id) this.querySelector(`[aria-controls="${CSS.escape(id)}"]`)?.setAttribute('aria-expanded', 'false');
        });
      }, NESTED_DEACTIVATE_DELAY);
    };

    // Cancel scheduled close when entering nested list; schedule when leaving it
    this.addEventListener('pointerenter', (event) => {
      if (event.target.closest('.mega-menu__nested')) {
        if (nestedCloseTimeout) clearTimeout(nestedCloseTimeout);
      }
    }, { signal: this.#abortController.signal });

    // Use pointerout (bubbling) to detect leaving key areas
    this.addEventListener('pointerout', (event) => {
      const from = event.target instanceof Element ? event.target : null;
      const to = event.relatedTarget instanceof Element ? event.relatedTarget : null;
      if (!from) return;

      // Leaving a nested list entirely
      if (from.closest('.mega-menu__nested') && (!to || !to.closest('.mega-menu__nested'))) {
        scheduleClose();
        return;
      }

      // Leaving the submenu container area entirely (not heading into nested list or another item within the same container)
      const submenuContainer = from.closest('.menu-list__submenu-inner');
      if (submenuContainer && (!to || !submenuContainer.contains(to))) {
        scheduleClose();
      }
    }, { signal: this.#abortController.signal });

    // Close nested submenu on outside click
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      // Ignore clicks on nested parent links or the nested lists themselves
      if (target.closest('.mega-menu__link--parent') || target.closest('.mega-menu__nested')) return;

      // If click is outside any nested menu, close all nested lists (keep main submenu open)
      this.querySelectorAll('.mega-menu__nested:not([hidden])')
        .forEach((openList) => {
          openList.setAttribute('hidden', '');
          const id = openList.getAttribute('id');
          if (id) {
            const openLink = this.querySelector(`[aria-controls="${CSS.escape(id)}"]`);
            if (openLink) openLink.setAttribute('aria-expanded', 'false');
          }
        });
    }, { signal: this.#abortController.signal });

    // Close nested submenu on Escape key
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      this.querySelectorAll('.mega-menu__nested:not([hidden])')
        .forEach((openList) => {
          openList.setAttribute('hidden', '');
          const id = openList.getAttribute('id');
          if (id) {
            const openLink = this.querySelector(`[aria-controls="${CSS.escape(id)}"]`);
            if (openLink) openLink.setAttribute('aria-expanded', 'false');
          }
        });
    }, { signal: this.#abortController.signal });

    onDocumentLoaded(this.#preloadImages);

    // No scroll/resize listeners needed when positioned relative to container
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
