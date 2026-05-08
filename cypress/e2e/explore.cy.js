describe('Explore view — feed', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="explore"]', { timeout: 8000 }).click();
    cy.get('#view-explore').should('not.have.class', 'hidden');
  });

  it('shows a feed card with seed and tags', () => {
    cy.get('#feed-card').should('be.visible');
    cy.get('#feed-seed').should('contain', 'seed');
    cy.get('#feed-tags').children().its('length').should('be.greaterThan', 1);
  });

  it('Skip records and advances the feed', () => {
    cy.get('#feed-seed').invoke('text').then((before) => {
      cy.get('#feed-skip').click();
      cy.wait(500);
      cy.get('#feed-seed').invoke('text').should('not.equal', before);
    });
  });

  it('Like records and advances the feed', () => {
    cy.get('#feed-seed').invoke('text').then((before) => {
      cy.get('#feed-like').click();
      cy.wait(500);
      cy.get('#feed-seed').invoke('text').should('not.equal', before);
    });
    cy.get('#explore-count-liked').should('have.text', '1');
  });

  it('opens Wrapped overlay (locked under 3 likes)', () => {
    cy.get('#explore-wrapped-btn').click();
    cy.get('#wrapped-overlay').should('not.have.class', 'hidden');
    cy.get('#wrapped-body').should('contain', 'Like at least 3 seeds');
  });
});
