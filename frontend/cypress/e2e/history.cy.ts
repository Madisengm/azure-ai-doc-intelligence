describe('History page', () => {

  describe('With results (mocked)', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/get-results', {
        fixture: 'extraction-results.json'
      }).as('getResults');

      cy.visit('/history');
      cy.wait('@getResults');
    });

    it('renders the Processing History heading', () => {
      cy.contains('Processing History').should('be.visible');
    });

    it('renders the New Upload button', () => {
      cy.contains('New Upload').should('be.visible');
    });

    it('renders completed result card', () => {
      cy.contains('test-cv.pdf').should('be.visible');
    });

    it('renders completed status badge', () => {
      cy.contains('completed').should('be.visible');
    });

    it('renders processing status badge', () => {
      cy.contains('processing').should('be.visible');
    });

    it('renders average confidence score on completed result', () => {
      cy.contains('avg confidence').should('be.visible');
    });

    it('renders document type label', () => {
      cy.contains('CV / Resume').should('be.visible');
    });

    it('renders View details link on completed result', () => {
      cy.contains('View details').should('be.visible');
    });

    it('navigates to result page when completed card is clicked', () => {
      cy.contains('test-cv.pdf').click();
      cy.url().should('include', '/result/test-uuid-001');
    });

    it('New Upload button navigates to upload page', () => {
      cy.contains('New Upload').click();
      cy.url().should('include', '/upload');
    });
  });

  describe('Empty state', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/get-results', {
        statusCode: 200,
        body: { results: [] }
      }).as('getResultsEmpty');

      cy.visit('/history');
      cy.wait('@getResultsEmpty');
    });

    it('renders empty state message', () => {
      cy.contains('No documents yet').should('be.visible');
    });

    it('renders upload prompt link', () => {
      cy.contains('Upload a document').should('be.visible');
    });
  });

});