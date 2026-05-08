describe('Compose view — section management', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="compose"]', { timeout: 8000 }).click();
    cy.get('#view-compose').should('not.have.class', 'hidden');
  });

  it('starts empty and shows the empty hint', () => {
    cy.get('#compose-empty').should('be.visible');
    cy.get('.section-block').should('not.exist');
  });

  it('adds a section', () => {
    cy.get('#compose-add').click();
    cy.get('.section-block').should('have.length', 1);
    cy.get('#compose-empty').should('not.be.visible');
  });

  it('adds three sections in order: Intro, Verse, Chorus', () => {
    cy.get('#compose-add').click();
    cy.get('#compose-add').click();
    cy.get('#compose-add').click();
    cy.get('.section-block').should('have.length', 3);
    cy.get('.section-block').eq(0).find('.section-block-name').should('have.value', 'Intro');
    cy.get('.section-block').eq(1).find('.section-block-name').should('have.value', 'Verse');
    cy.get('.section-block').eq(2).find('.section-block-name').should('have.value', 'Chorus');
  });

  it('Play button enables once a section exists', () => {
    cy.get('#compose-play').should('be.disabled');
    cy.get('#compose-add').click();
    cy.get('#compose-play').should('not.be.disabled');
  });

  it('Reseed mints a new seed for the section', () => {
    cy.get('#compose-add').click();
    cy.get('.section-block-meta').first().invoke('text').then((before) => {
      cy.get('.section-block').first().find('[data-action="reseed"]').click();
      cy.get('.section-block-meta').first().invoke('text').should('not.equal', before);
    });
  });

  it('Remove deletes the section', () => {
    cy.get('#compose-add').click();
    cy.get('#compose-add').click();
    cy.get('.section-block').should('have.length', 2);
    cy.get('.section-block').first().find('[data-action="remove"]').click();
    cy.get('.section-block').should('have.length', 1);
  });

  it('Undo restores a removed section', () => {
    cy.get('#compose-add').click();
    cy.get('#compose-add').click();
    cy.get('.section-block').first().find('[data-action="remove"]').click();
    cy.get('.section-block').should('have.length', 1);
    cy.get('#compose-undo').click();
    cy.get('.section-block').should('have.length', 2);
  });

  it('persists sections across reloads', () => {
    cy.get('#compose-add').click();
    cy.get('#compose-add').click();
    cy.get('.section-block').should('have.length', 2);
    // Full page reload — must keep onboarding flag set so we land in the
    // app rather than the tour, then re-navigate to the Compose view.
    cy.window().then((win) => {
      win.localStorage.setItem('seedsong-onboarding-done', '1');
    });
    cy.reload();
    cy.get('.sidebar-link[data-view="compose"]', { timeout: 8000 }).click();
    cy.get('#view-compose').should('not.have.class', 'hidden');
    cy.get('.section-block').should('have.length', 2);
  });

  it('toggles a track chip on a section', () => {
    cy.get('#compose-add').click();
    cy.get('.section-block').first()
      .find('[data-track="chord"]')
      .as('chordChip');
    cy.get('@chordChip').should('have.class', 'active');
    cy.get('@chordChip').click();
    cy.get('.section-block').first()
      .find('[data-track="chord"]')
      .should('not.have.class', 'active');
  });
});
