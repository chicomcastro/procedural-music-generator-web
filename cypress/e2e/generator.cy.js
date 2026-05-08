describe('Generator view — core flow', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('#hero', { timeout: 8000 }).should('be.visible');
  });

  it('loads the Generator view by default', () => {
    cy.get('#view-generator').should('not.have.class', 'hidden');
    cy.get('#score-canvas').should('be.visible');
  });

  it('Randomize generates a fresh seed', () => {
    cy.get('#seed').invoke('val').then((before) => {
      cy.get('#generate-btn').click();
      cy.wait(200);
      cy.get('#seed').invoke('val').should('not.equal', before);
    });
  });

  it('Same seed regenerates the same song info', () => {
    cy.get('#seed').clear().type('42').blur();
    cy.get('#song-info').then(($infoA) => {
      const a = $infoA.text();
      cy.get('#seed').clear().type('999').blur();
      cy.wait(150);
      cy.get('#seed').clear().type('42').blur();
      cy.wait(150);
      cy.get('#song-info').should((info) => {
        expect(info.text()).to.eq(a);
      });
    });
  });

  it('Applies a Genre preset and updates BPM', () => {
    cy.get('.preset-btn').contains('Lo-fi').click();
    cy.get('#bpm-display').should('contain', '72');
  });

  it('Switches between Piano Roll and Sheet Music views', () => {
    cy.get('#view-pianoroll').should('have.class', 'active');
    cy.get('#view-sheetmusic').click();
    cy.get('#view-sheetmusic').should('have.class', 'active');
    cy.get('#view-pianoroll').click();
    cy.get('#view-pianoroll').should('have.class', 'active');
  });
});
