import { Component } from '@theme/component';
import { DialogComponent, DialogOpenEvent, DialogCloseEvent } from '@theme/dialog';

/**
 * Quick View Drawer Component
 * Provides a bottom slide-up drawer for quick product viewing
 * 
 * @extends DialogComponent
 */
export class QuickViewDrawer extends DialogComponent {
  requiredRefs = ['dialog', 'drawerContent', 'backdrop'];

  /** @type {AbortController | null} */
  #abortController = null;

  /** @type {Map<string, Element>} */
  #cachedContent = new Map();

  connectedCallback() {
    super.connectedCallback();
    
    // Listen for quick view button clicks
    document.addEventListener('click', this.#handleQuickViewClick);
    
    // Add swipe-to-close functionality
    this.#setupSwipeToClose();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this.#handleQuickViewClick);
    this.#abortController?.abort();
  }

  /**
   * Handles quick view button clicks
   * @param {Event} event - The click event
   */
  #handleQuickViewClick = async (event) => {
    const quickViewBtn = event.target.closest('.product-card__quick-view-btn');
    if (!quickViewBtn) return;

    event.preventDefault();
    event.stopPropagation();

    const productId = quickViewBtn.dataset.productId;
    const productHandle = quickViewBtn.dataset.productHandle;

    if (!productId || !productHandle) return;

    await this.#loadProductData(productHandle);
    this.showDialog();
  };

  /**
   * Loads product data and updates drawer content
   * @param {string} productHandle - The product handle
   */
  async #loadProductData(productHandle) {
    const { drawerContent } = this.refs;
    
    // Show loading state
    this.#showLoading();

    try {
      // Check cache first
      let productData = this.#cachedContent.get(productHandle);
      
      if (!productData) {
        // Fetch product data
        const response = await fetch(`/products/${productHandle}?view=quick-view`);
        if (!response.ok) throw new Error('Failed to fetch product data');
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract product data from the response
        productData = this.#extractProductData(doc);
        this.#cachedContent.set(productHandle, productData);
      }

      // Update drawer content
      this.#updateDrawerContent(productData);
      
    } catch (error) {
      console.error('Error loading product data:', error);
      this.#showError();
    }
  }

  /**
   * Extracts product data from the HTML document
   * @param {Document} doc - The parsed HTML document
   * @returns {Object} Extracted product data
   */
  #extractProductData(doc) {
    const productElement = doc.querySelector('[data-product-json]');
    const product = productElement ? JSON.parse(productElement.textContent) : null;
    
    if (!product) {
      throw new Error('Product data not found');
    }

    return {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      compare_at_price: product.compare_at_price,
      available: product.available,
      images: product.images || [],
      variants: product.variants || [],
      options: product.options || [],
      handle: product.handle
    };
  }

  /**
   * Updates the drawer content with product data
   * @param {Object} productData - The product data
   */
  #updateDrawerContent(productData) {
    const { drawerContent } = this.refs;
    
    const content = this.#buildProductContent(productData);
    drawerContent.innerHTML = content;
    
    // Initialize interactive elements
    this.#initializeVariantPicker(productData);
    this.#initializeQuantitySelector();
    this.#initializeAddToCart(productData);
  }

  /**
   * Builds the HTML content for the product
   * @param {Object} product - The product data
   * @returns {string} HTML content
   */
  #buildProductContent(product) {
    const priceDisplay = this.#formatPrice(product.price, product.compare_at_price);
    const mediaGallery = this.#buildMediaGallery(product.images);
    const variantOptions = this.#buildVariantOptions(product);
    
    return `
      <div class="quick-view-product-header">
        <h2 class="quick-view-product-title">${product.title}</h2>
        <div class="quick-view-product-price">${priceDisplay}</div>
        ${product.description ? `<div class="quick-view-product-description">${product.description}</div>` : ''}
      </div>
      
      ${mediaGallery}
      
      <div class="quick-view-product-content">
        ${variantOptions}
        
        <div class="quick-view-actions">
          <div class="quick-view-quantity-cart">
            <div class="quick-view-quantity">
              <button type="button" class="quantity-btn quantity-minus" aria-label="Decrease quantity">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
              <input type="number" class="quantity-input" value="1" min="1" max="999">
              <button type="button" class="quantity-btn quantity-plus" aria-label="Increase quantity">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <button type="button" class="quick-view-add-to-cart" data-product-id="${product.id}">
              <span class="add-to-cart-text">Add to Cart</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" class="cart-icon">
                <path d="M3 3h1.5l1.7 9.4a1 1 0 001 .8h8.4a1 1 0 001-.8L17.5 5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="7.5" cy="16.5" r="0.5" fill="currentColor"/>
                <circle cx="14.5" cy="16.5" r="0.5" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Builds the media gallery HTML
   * @param {Array} images - Array of product images
   * @returns {string} Media gallery HTML
   */
  #buildMediaGallery(images) {
    if (!images || images.length === 0) return '';
    
    const imageItems = images.slice(0, 5).map(image => `
      <div class="quick-view-media-item">
        <img src="${image}" alt="Product image" loading="lazy">
      </div>
    `).join('');
    
    return `
      <div class="quick-view-media-gallery">
        <div class="quick-view-media-scroll">
          ${imageItems}
        </div>
      </div>
    `;
  }

  /**
   * Builds variant options HTML
   * @param {Object} product - The product data
   * @returns {string} Variant options HTML
   */
  #buildVariantOptions(product) {
    if (!product.options || product.options.length === 0) return '';
    
    return `
      <div class="quick-view-variants">
        ${product.options.map((option, index) => `
          <div class="quick-view-variant-group" data-option-index="${index}">
            <div class="quick-view-variant-label">${option.name}</div>
            <div class="quick-view-variant-options">
              ${option.values.map(value => `
                <button type="button" class="quick-view-variant-option" data-value="${value}">
                  ${value}
                </button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Formats price display
   * @param {number} price - Current price
   * @param {number} comparePrice - Compare at price
   * @returns {string} Formatted price HTML
   */
  #formatPrice(price, comparePrice) {
    const currentPrice = (price / 100).toFixed(2);
    
    if (comparePrice && comparePrice > price) {
      const originalPrice = (comparePrice / 100).toFixed(2);
      return `
        <span class="price-current">$${currentPrice}</span>
        <span class="price-compare">$${originalPrice}</span>
      `;
    }
    
    return `<span class="price-current">$${currentPrice}</span>`;
  }

  /**
   * Initializes variant picker functionality
   * @param {Object} product - The product data
   */
  #initializeVariantPicker(product) {
    const variantOptions = this.refs.drawerContent.querySelectorAll('.quick-view-variant-option');
    
    variantOptions.forEach(option => {
      option.addEventListener('click', (e) => {
        const group = e.target.closest('.quick-view-variant-group');
        const siblings = group.querySelectorAll('.quick-view-variant-option');
        
        siblings.forEach(sibling => sibling.classList.remove('selected'));
        e.target.classList.add('selected');
        
        this.#updateSelectedVariant(product);
      });
    });
    
    // Select first option of each group by default
    const firstOptions = this.refs.drawerContent.querySelectorAll('.quick-view-variant-group .quick-view-variant-option:first-child');
    firstOptions.forEach(option => option.classList.add('selected'));
  }

  /**
   * Initializes quantity selector functionality
   */
  #initializeQuantitySelector() {
    const quantityInput = this.refs.drawerContent.querySelector('.quantity-input');
    const minusBtn = this.refs.drawerContent.querySelector('.quantity-minus');
    const plusBtn = this.refs.drawerContent.querySelector('.quantity-plus');
    
    minusBtn?.addEventListener('click', () => {
      const currentValue = parseInt(quantityInput.value) || 1;
      if (currentValue > 1) {
        quantityInput.value = currentValue - 1;
      }
    });
    
    plusBtn?.addEventListener('click', () => {
      const currentValue = parseInt(quantityInput.value) || 1;
      if (currentValue < 999) {
        quantityInput.value = currentValue + 1;
      }
    });
  }

  /**
   * Initializes add to cart functionality
   * @param {Object} product - The product data
   */
  #initializeAddToCart(product) {
    const addToCartBtn = this.refs.drawerContent.querySelector('.quick-view-add-to-cart');
    
    addToCartBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.#handleAddToCart(product);
    });
  }

  /**
   * Handles add to cart action
   * @param {Object} product - The product data
   */
  async #handleAddToCart(product) {
    const addToCartBtn = this.refs.drawerContent.querySelector('.quick-view-add-to-cart');
    const quantityInput = this.refs.drawerContent.querySelector('.quantity-input');
    
    if (!addToCartBtn || !quantityInput) return;
    
    const quantity = parseInt(quantityInput.value) || 1;
    const selectedVariant = this.#getSelectedVariant(product);
    
    if (!selectedVariant) {
      console.error('No variant selected');
      return;
    }
    
    // Show loading state
    addToCartBtn.disabled = true;
    const originalText = addToCartBtn.querySelector('.add-to-cart-text').textContent;
    addToCartBtn.querySelector('.add-to-cart-text').textContent = 'Adding...';
    
    try {
      const formData = new FormData();
      formData.append('id', selectedVariant.id);
      formData.append('quantity', quantity);
      
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to add to cart');
      
      const result = await response.json();
      
      // Success feedback
      addToCartBtn.querySelector('.add-to-cart-text').textContent = 'Added!';
      setTimeout(() => {
        addToCartBtn.querySelector('.add-to-cart-text').textContent = originalText;
        addToCartBtn.disabled = false;
      }, 1500);
      
      // Trigger cart update event
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: result }));
      
      // Close drawer after successful add
      setTimeout(() => this.closeDialog(), 1000);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      addToCartBtn.querySelector('.add-to-cart-text').textContent = 'Try Again';
      setTimeout(() => {
        addToCartBtn.querySelector('.add-to-cart-text').textContent = originalText;
        addToCartBtn.disabled = false;
      }, 2000);
    }
  }

  /**
   * Gets the currently selected variant
   * @param {Object} product - The product data
   * @returns {Object|null} Selected variant or null
   */
  #getSelectedVariant(product) {
    const selectedOptions = [];
    const variantGroups = this.refs.drawerContent.querySelectorAll('.quick-view-variant-group');
    
    variantGroups.forEach(group => {
      const selected = group.querySelector('.quick-view-variant-option.selected');
      if (selected) {
        selectedOptions.push(selected.dataset.value);
      }
    });
    
    // Find matching variant
    return product.variants.find(variant => {
      return selectedOptions.every((option, index) => 
        variant.options[index] === option
      );
    }) || product.variants[0];
  }

  /**
   * Updates the selected variant and UI
   * @param {Object} product - The product data
   */
  #updateSelectedVariant(product) {
    const selectedVariant = this.#getSelectedVariant(product);
    const addToCartBtn = this.refs.drawerContent.querySelector('.quick-view-add-to-cart');
    
    if (selectedVariant && addToCartBtn) {
      addToCartBtn.disabled = !selectedVariant.available;
      const buttonText = addToCartBtn.querySelector('.add-to-cart-text');
      buttonText.textContent = selectedVariant.available ? 'Add to Cart' : 'Sold Out';
    }
  }

  /**
   * Shows loading state
   */
  #showLoading() {
    const { drawerContent } = this.refs;
    drawerContent.innerHTML = `
      <div class="quick-view-drawer__loading">
        <div class="loading-spinner">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32" stroke-dashoffset="32">
              <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
              <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
            </circle>
          </svg>
          <span>Loading product details...</span>
        </div>
      </div>
    `;
  }

  /**
   * Shows error state
   */
  #showError() {
    const { drawerContent } = this.refs;
    drawerContent.innerHTML = `
      <div class="quick-view-drawer__loading">
        <div class="loading-spinner">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Error loading product. Please try again.</span>
        </div>
      </div>
    `;
  }

  /**
   * Sets up swipe-to-close functionality for mobile
   */
  #setupSwipeToClose() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    
    const { dialog } = this.refs;
    
    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    };
    
    const handleTouchMove = (e) => {
      if (!isDragging) return;
      
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Only allow downward swipes
      if (deltaY > 0) {
        const progress = Math.min(deltaY / 200, 1);
        dialog.style.transform = `translateY(${deltaY}px)`;
        dialog.style.opacity = `${1 - progress * 0.5}`;
      }
    };
    
    const handleTouchEnd = () => {
      if (!isDragging) return;
      
      const deltaY = currentY - startY;
      
      if (deltaY > 100) {
        // Close drawer if swiped down enough
        this.closeDialog();
      } else {
        // Snap back to position
        dialog.style.transform = '';
        dialog.style.opacity = '';
      }
      
      isDragging = false;
    };
    
    dialog.addEventListener('touchstart', handleTouchStart, { passive: true });
    dialog.addEventListener('touchmove', handleTouchMove, { passive: true });
    dialog.addEventListener('touchend', handleTouchEnd, { passive: true });
  }
}

// Register the custom element
if (!customElements.get('quick-view-drawer')) {
  customElements.define('quick-view-drawer', QuickViewDrawer);
}

export default QuickViewDrawer;
