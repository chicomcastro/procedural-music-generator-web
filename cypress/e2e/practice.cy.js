// Practice view smoke. Open the catalog, open a study, exercise the master
// difficulty slider + reroll button. The two-voice invention is the flagship
// study (the original use case: duet sight-reading with a practice partner).

describe('Practice view', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/app.html', {
      onBeforeLoad(win) {
        win.localStorage.setItem('seedsong-onboarding-done', '1');
      },
    });
    cy.get('.sidebar-link[data-view="practice"]', { timeout: 8000 }).click({ force: true });
    cy.get('#view-practice').should('not.have.class', 'hidden');
  });

  it('lists the studies in the catalog', () => {
    cy.get('.practice-card').its('length').should('be.gte', 2);
    cy.get('.practice-card[data-id="two-voice-invention"]').should('exist');
    cy.get('.practice-card[data-id="walking-bass-workout"]').should('exist');
  });

  it('opens the two-voice invention with all 3 acts', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-study-overlay').should('not.have.class', 'hidden');
    cy.get('#practice-study-title').should('contain', 'Two-voice Invention');
    cy.get('.practice-act-rail-item').should('have.length', 3);
  });

  it('master difficulty slider updates the controls-info chip', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-difficulty').invoke('val', 80).trigger('input');
    cy.get('#practice-difficulty-display').should('have.text', '80%');
    cy.get('#practice-controls-info').should('contain', '80%');
  });

  it('Roll-a-new-seed changes the seed input', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-seed').invoke('val').then((before) => {
      cy.get('#practice-reroll').click();
      cy.get('#practice-seed').invoke('val').should('not.equal', before);
    });
  });

  it('Close button returns to the catalog', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-study-close').click();
    cy.get('#practice-study-overlay').should('have.class', 'hidden');
  });

  it('persists last study + prefs across reloads', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-difficulty').invoke('val', 70).trigger('input');
    cy.reload();
    cy.get('.sidebar-link[data-view="practice"]').click({ force: true });
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-difficulty').should('have.value', '70');
  });

  it('Two-voice invention exposes clef + rhythm pickers; defaults to Bass+Bass / Square', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-clef').should('have.value', 'bass-bass');
    cy.get('#practice-rhythm').should('have.value', 'square');
    // Switch clef → controls-info chip reflects the change
    cy.get('#practice-clef').select('treble-bass');
    cy.get('#practice-controls-info').should('contain', 'treble+bass');
  });

  it('Walking-bass hides the rhythm picker and shows a clef option', () => {
    cy.get('.practice-card[data-id="walking-bass-workout"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    // Clef picker exists and has the bass-default option populated. Use
    // value+option count instead of `be.visible` to avoid racing the
    // details-open repaint.
    cy.get('#practice-clef').should('have.value', 'bass');
    cy.get('#practice-clef option').its('length').should('be.gte', 1);
    // Rhythm field is hidden via inline style (populateControls sets
    // display:'none' for studies without rhythmDefault).
    cy.get('#practice-rhythm-field').should('have.css', 'display', 'none');
  });

  it('Play button remains visible after scrolling (sticky transport)', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('.practice-stage').scrollTo('bottom', { ensureScrollable: false });
    cy.get('#practice-play').should('be.visible');
  });

  it('Duet style picker exists for the invention and changes affect the info chip', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-duet').should('have.value', 'free');
    cy.get('#practice-duet').select('parallel_thirds');
    cy.get('#practice-controls-info').should('contain', 'Parallel thirds');
  });

  it('Favorite button persists the current snapshot and surfaces it on the catalog', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-study-favorite').click();
    cy.get('#practice-study-favorite').should('have.class', 'is-favorited');
    cy.get('#practice-study-close').click();
    cy.get('#practice-favorites-section').should('be.visible');
    cy.get('.practice-favorite-card').should('have.length', 1);
  });

  it('Share URL deep link applies the params and opens the study', () => {
    // Visit the app with a share URL directly.
    cy.visit('/app.html#/practice?study=two-voice-invention&seed=42&key=5&clef=treble-bass&rhythm=walking&duet=parallel_sixths&diff=70', {
      onBeforeLoad(win) { win.localStorage.setItem('seedsong-onboarding-done', '1'); },
    });
    cy.get('#practice-study-overlay', { timeout: 8000 }).should('not.have.class', 'hidden');
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-key').should('have.value', '5');
    cy.get('#practice-seed').should('have.value', '42');
    cy.get('#practice-clef').should('have.value', 'treble-bass');
    cy.get('#practice-rhythm').should('have.value', 'walking');
    cy.get('#practice-duet').should('have.value', 'parallel_sixths');
    cy.get('#practice-difficulty').should('have.value', '70');
  });

  it('Performance group (Scale + Contour + Swing + Intensity) is wired', () => {
    cy.get('.practice-card[data-id="two-voice-invention"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);

    // Defaults
    cy.get('#practice-scale').should('have.value', 'auto');
    cy.get('#practice-contour').should('have.value', 'auto');
    cy.get('#practice-swing').should('have.value', '0');
    cy.get('#practice-intensity').should('have.value', '100');

    // Change scale → info chip picks it up
    cy.get('#practice-scale').select('dorian');
    cy.get('#practice-controls-info').should('contain', 'Dorian');

    // Change contour → info chip picks it up
    cy.get('#practice-contour').select('ascending');
    cy.get('#practice-controls-info').should('contain', 'Ascending');

    // Swing slider updates its display
    cy.get('#practice-swing').invoke('val', 40).trigger('input');
    cy.get('#practice-swing-display').should('have.text', '40%');

    // Intensity slider updates its display
    cy.get('#practice-intensity').invoke('val', 75).trigger('input');
    cy.get('#practice-intensity-display').should('have.text', '75%');
  });

  it('Walking-bass shows the Performance group with Rhythm/Duet/Contour/Swing hidden', () => {
    cy.get('.practice-card[data-id="walking-bass-workout"]').click();
    cy.get('#practice-controls').then(($d) => $d[0].open = true);
    cy.get('#practice-scale').should('be.visible');
    cy.get('#practice-intensity').should('be.visible');
    cy.get('#practice-contour-field').should('have.css', 'display', 'none');
    cy.get('#practice-swing-field').should('have.css', 'display', 'none');
    cy.get('#practice-rhythm-field').should('have.css', 'display', 'none');
    cy.get('#practice-duet-field').should('have.css', 'display', 'none');
  });
});
