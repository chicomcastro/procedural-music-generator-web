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

  it('lists all main views', () => {
    cy.get('.sidebar-link[data-view="generator"]').should('exist');
    cy.get('.sidebar-link[data-view="explore"]').should('exist');
    cy.get('.sidebar-link[data-view="compose"]').should('exist');
    cy.get('.sidebar-link[data-view="learn"]').should('exist');
    cy.get('.sidebar-link[data-view="practice"]').should('exist');
  });

  it('navigates between views via hash routing', () => {
    cy.get('.sidebar-link[data-view="explore"]').click();
    cy.location('hash').should('eq', '#/explore');
    cy.get('#view-explore').should('not.have.class', 'hidden');
    cy.get('#view-generator').should('have.class', 'hidden');

    cy.get('.sidebar-link[data-view="compose"]').click();
    cy.location('hash').should('eq', '#/compose');
    cy.get('#view-compose').should('not.have.class', 'hidden');

    cy.get('.sidebar-link[data-view="learn"]').click();
    cy.location('hash').should('eq', '#/learn');
    cy.get('#view-learn').should('not.have.class', 'hidden');

    cy.get('.sidebar-link[data-view="generator"]').click();
    cy.location('hash').should('eq', '#/generator');
    cy.get('#view-generator').should('not.have.class', 'hidden');
  });

  it('hamburger toggles the sidebar visibility class', () => {
    // Desktop default: sidebar is open. Toggle closes it.
    cy.get('#sidebar').should('have.class', 'open');
    cy.get('#sidebar-toggle').click();
    cy.get('#sidebar').should('not.have.class', 'open');
    cy.get('#sidebar-toggle').click();
    cy.get('#sidebar').should('have.class', 'open');
  });

  it('hides the transport bar outside Generator', () => {
    cy.get('#transport-bar').should('not.have.class', 'view-hidden');
    cy.get('.sidebar-link[data-view="explore"]').click();
    cy.get('#transport-bar', { timeout: 5000 }).should('have.class', 'view-hidden');
    cy.get('.sidebar-link[data-view="generator"]').click();
    cy.get('#transport-bar').should('not.have.class', 'view-hidden');
  });
});
