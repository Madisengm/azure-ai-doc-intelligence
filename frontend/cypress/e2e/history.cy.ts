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

  // ─── Semantic search ───────────────────────────────────────────────────────

  describe('Semantic search bar', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/get-results', {
        fixture: 'extraction-results.json'
      }).as('getResults');

      cy.visit('/history');
      cy.wait('@getResults');
    });

    it('renders the search input', () => {
      cy.get('input[placeholder*="semantically"]').should('be.visible');
    });

    it('Search button is disabled when query is empty', () => {
      cy.contains('Search').should('be.disabled');
    });

    it('Search button enables when query is typed', () => {
      cy.get('input[placeholder*="semantically"]').type('Angular developer');
      cy.contains('Search').should('not.be.disabled');
    });

    it('shows semantic search results after searching', () => {
      cy.intercept('POST', '/api/search-documents', {
        fixture: 'similar-results.json'
      }).as('search');

      cy.get('input[placeholder*="semantically"]').type('Angular developer');
      cy.contains('Search').click();
      cy.wait('@search');

      cy.contains('semantic search result').should('be.visible');
      cy.contains('test-cv-2.pdf').should('be.visible');
    });

    it('shows similarity percentage on search results', () => {
      cy.intercept('POST', '/api/search-documents', {
        fixture: 'similar-results.json'
      }).as('search');

      cy.get('input[placeholder*="semantically"]').type('Angular developer');
      cy.contains('Search').click();
      cy.wait('@search');

      cy.contains('% match').should('be.visible');
    });

    it('Clear button resets the search', () => {
      cy.intercept('POST', '/api/search-documents', {
        fixture: 'similar-results.json'
      }).as('search');

      cy.get('input[placeholder*="semantically"]').type('Angular developer');
      cy.contains('Search').click();
      cy.wait('@search');

      cy.contains('Clear').click();
      cy.contains('semantic search result').should('not.exist');
      cy.contains('test-cv-2.pdf').should('not.exist');
    });
  });

  // ─── Empty state ───────────────────────────────────────────────────────────

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