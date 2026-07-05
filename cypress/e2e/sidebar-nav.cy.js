describe('Sidebar navigation', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('#sidebar', { timeout: 8000 }).should('exist');
  });

  it('lists the practice-first views (ADR 0005)', () => {
    cy.get('.sidebar-link[data-view="practice"]').should('exist');
    cy.get('.sidebar-link[data-view="learn"]').should('exist');
    cy.get('.sidebar-link[data-view="generator"]').should('exist');
    cy.get('.sidebar-link[data-view="settings"]').should('exist');
    // Explore / Radio / Compose left the navigation.
    cy.get('.sidebar-link[data-view="explore"]').should('not.exist');
    cy.get('.sidebar-link[data-view="radio"]').should('not.exist');
    cy.get('.sidebar-link[data-view="compose"]').should('not.exist');
  });

  it('loads the Practice view by default', () => {
    cy.get('#view-practice').should('not.have.class', 'hidden');
    cy.get('#view-generator').should('have.class', 'hidden');
    cy.get('.sidebar-link[data-view="practice"]').should('have.class', 'active');
  });

  it('navigates between views via hash routing', () => {
    cy.get('.sidebar-link[data-view="learn"]').click();
    cy.location('hash').should('eq', '#/learn');
    cy.get('#view-learn').should('not.have.class', 'hidden');
    cy.get('#view-practice').should('have.class', 'hidden');

    cy.get('.sidebar-link[data-view="generator"]').click();
    cy.location('hash').should('eq', '#/generator');
    cy.get('#view-generator').should('not.have.class', 'hidden');

    cy.get('.sidebar-link[data-view="practice"]').click();
    cy.location('hash').should('eq', '#/practice');
    cy.get('#view-practice').should('not.have.class', 'hidden');
  });

  it('keeps deep-link routes working for views outside the nav', () => {
    // ADR 0005: Explore / Radio / Compose left the nav but bookmarks
    // and share links must keep resolving.
    cy.visit('/app.html#/compose', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('#view-compose', { timeout: 8000 }).should('not.have.class', 'hidden');

    cy.visit('/app.html#/explore', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('#view-explore', { timeout: 8000 }).should('not.have.class', 'hidden');
  });

  it('hamburger toggles the sidebar visibility class', () => {
    // Desktop default: sidebar is open. Toggle closes it.
    cy.get('#sidebar').should('have.class', 'open');
    cy.get('#sidebar-toggle').click();
    cy.get('#sidebar').should('not.have.class', 'open');
    cy.get('#sidebar-toggle').click();
    cy.get('#sidebar').should('have.class', 'open');
  });

  it('shows the transport bar only on the Generator view', () => {
    // Practice is the default view → transport starts hidden.
    cy.get('#transport-bar').should('have.class', 'view-hidden');
    cy.get('.sidebar-link[data-view="generator"]').click();
    cy.get('#transport-bar', { timeout: 5000 }).should('not.have.class', 'view-hidden');
    cy.get('.sidebar-link[data-view="practice"]').click();
    cy.get('#transport-bar').should('have.class', 'view-hidden');
  });
});
