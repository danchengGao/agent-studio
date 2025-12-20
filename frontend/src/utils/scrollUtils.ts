/**
 * Scroll utility functions for consistent scroll behavior across the application
 */

/**
 * Scroll the main content container to the top
 * This function targets the main content area within the Layout component
 */
export const scrollToTop = (behavior: ScrollBehavior = 'smooth'): void => {
  // Try to find the main content element within the Layout
  const mainElement = document.querySelector('main[role="main"]') || document.querySelector('main') || document.querySelector('.overflow-y-auto')

  if (mainElement) {
    // Scroll the main content container
    mainElement.scrollTop = 0
  } else {
    // Fallback to window scroll if no main container found
    window.scrollTo({ top: 0, left: 0, behavior })
  }
}

/**
 * Scroll a specific element to the top within its scrollable container
 */
export const scrollElementToTop = (elementId: string, behavior: ScrollBehavior = 'smooth'): void => {
  const element = document.getElementById(elementId)
  if (element) {
    const scrollContainer = element.closest('.overflow-y-auto') || element.closest('main') || element.closest('[role="main"]') || window

    if (scrollContainer instanceof Window) {
      window.scrollTo({ top: 0, left: 0, behavior })
    } else {
      scrollContainer.scrollTop = 0
    }
  }
}

/**
 * Reset scroll position when navigating to a new page
 */
export const resetScrollOnNavigation = (): void => {
  // Small delay to ensure route has changed
  setTimeout(() => {
    scrollToTop()
  }, 50)
}
