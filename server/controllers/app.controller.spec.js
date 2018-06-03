const chai = require('chai');
const sinonChai = require('sinon-chai');
const sinon = require('sinon');
const AppController = require('./app.controller');
const sinonMock = require('sinon-express-mock');
const modulesMocks = require('../../test-utilities/modules-mock');
const expect = chai.expect;

const redisClientFactoryStub = {
  createClient: () => {
    return modulesMocks.redisClient;
  },
};
const dopplerClientFactoryStub = {
  createClient: () => {
    return modulesMocks.dopplerClient;
  },
};
const shopifyClientFactoryStub = {
  createClient: () => {
    return modulesMocks.shopifyClient;
  },
};

describe('The app controller', function() {
  before(function() {
    chai.use(sinonChai);
  });

  beforeEach(function() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  it('home should render the home page when shop is stored in Redis correctly', async function() {
    const request = sinonMock.mockReq({
      session: {
        accessToken: 'fb5d67a5bd67ab5d67ab5d',
        shop: 'store.myshopify.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'fb5d67a5bd67ab5d67ab5d',
        dopplerAccountName: 'user@example.com',
        dopplerListId: 46273,
        dopplerListName: 'customers',
        fieldsMapping: '[{"s1":"d1"}]',
        setupCompleted: true,
        synchronizationInProgress: false,
        lastSynchronizationDate: '2015-06-01T23:22:23.694Z',
      })
    );

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.home(request, response);

    expect(response.render).to.be.called.calledWithExactly('app', {
      title: 'Doppler for Shopify',
      apiKey: '1234567890',
      shop: 'store.myshopify.com',
      dopplerAccountName: 'user@example.com',
      dopplerListId: 46273,
      dopplerListName: 'customers',
      fieldsMapping: '[{"s1":"d1"}]',
      setupCompleted: true,
      synchronizationInProgress: false,
      lastSynchronizationDate: '2015-06-01T23:22:23.694Z',
    });

    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com', true);
  });

  it('home should redirect to authorization page when shop is not stored in Redis', async function() {
    const request = sinonMock.mockReq({
      session: {
        accessToken: 'fb5d67a5bd67ab5d67ab5d',
        shop: 'store.myshopify.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox
      .stub(modulesMocks.redisClient, 'getShopAsync')
      .returns(Promise.resolve(null));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.home(request, response);

    expect(response.redirect).to.be.called.calledWithExactly(
      '/shopify/auth?shop=store.myshopify.com'
    );
    expect(response.render).to.have.been.callCount(0);
  });

  it('home should redirect to authorization page when session and Redis access tokens do not match', async function() {
    const request = sinonMock.mockReq({
      session: {
        accessToken: 'fb5d67a5bd67ab5d67ab5d',
        shop: 'store.myshopify.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox
      .stub(modulesMocks.redisClient, 'getShopAsync')
      .returns(Promise.resolve({ accessToken: 'ae768b8c78d68a54565434' }));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.home(request, response);

    expect(response.redirect).to.be.called.calledWithExactly(
      '/shopify/auth?shop=store.myshopify.com'
    );
    expect(response.render).to.have.been.callCount(0);
  });

  it('connectToDoppler should store the Doppler account name and API key when credentials are valid', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: {
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'storeShopAsync');
    this.sandbox
      .stub(modulesMocks.dopplerClient, 'AreCredentialsValidAsync')
      .returns(Promise.resolve(true));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.connectToDoppler(request, response);

    expect(
      modulesMocks.dopplerClient.AreCredentialsValidAsync
    ).to.have.been.callCount(1);
    expect(
      modulesMocks.redisClient.storeShopAsync
    ).to.be.called.calledWithExactly(
      'store.myshopify.com',
      {
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      },
      true
    );
    expect(response.sendStatus).to.be.called.calledWithExactly(200);
  });

  it('connectToDoppler should return "Invalid credentials" when Doppler credentials are invalid', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: {
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'storeShopAsync');
    this.sandbox
      .stub(modulesMocks.dopplerClient, 'AreCredentialsValidAsync')
      .returns(Promise.resolve(false));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.connectToDoppler(request, response);

    expect(
      modulesMocks.dopplerClient.AreCredentialsValidAsync
    ).to.have.been.callCount(1);
    expect(modulesMocks.redisClient.storeShopAsync).to.have.been.callCount(0);
    expect(response.sendStatus).to.be.called.calledWithExactly(401);
  });

  it('getDopplerLists should return the lists from Doppler', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'ae768b8c78d68a54565434',
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      })
    );

    this.sandbox.stub(modulesMocks.dopplerClient, 'getListsAsync').returns(
      Promise.resolve({
        items: [
          { listId: 1459381, name: 'shopify' },
          { listId: 1222381, name: 'marketing' },
          { listId: 1170501, name: 'development' },
        ],
        itemsCount: 3,
      })
    );

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.getDopplerLists(request, response);

    expect(modulesMocks.dopplerClient.getListsAsync).to.have.been.callCount(1);
    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com', true);
    expect(response.json).to.be.called.calledWithExactly({
      items: [
        { listId: 1459381, name: 'shopify' },
        { listId: 1222381, name: 'marketing' },
        { listId: 1170501, name: 'development' },
      ],
      itemsCount: 3,
    });
  });

  it('createDopplerList should create the list in Doppler', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: { name: 'Fresh list' },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'ae768b8c78d68a54565434',
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      })
    );

    this.sandbox
      .stub(modulesMocks.dopplerClient, 'createListAsync')
      .returns(Promise.resolve(458712));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.createDopplerList(request, response);

    expect(
      modulesMocks.dopplerClient.createListAsync
    ).to.be.called.calledWithExactly('Fresh list');
    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com', true);
    expect(response.status).to.be.called.calledWithExactly(201);
    expect(response.send).to.be.called.calledWithExactly({ listId: 458712 });
  });

  it('createDopplerList should 400 status code when duplicated list name', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: { name: 'Fresh list' },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'ae768b8c78d68a54565434',
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      })
    );

    this.sandbox
      .stub(modulesMocks.dopplerClient, 'createListAsync')
      .throws({ statusCode: 400, errorCode: 2 });

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.createDopplerList(request, response);

    expect(
      modulesMocks.dopplerClient.createListAsync
    ).to.be.called.calledWithExactly('Fresh list');
    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com', true);
    expect(response.sendStatus).to.be.called.calledWithExactly(400);
  });

  it('setDopplerList should store the doppler list id in Redis', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: { dopplerListId: 15457, dopplerListName: 'customers' },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'storeShopAsync');

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.setDopplerList(request, response);

    expect(
      modulesMocks.redisClient.storeShopAsync
    ).to.be.called.calledWithExactly(
      'store.myshopify.com',
      { dopplerListId: 15457, dopplerListName: 'customers' },
      true
    );
    expect(response.sendStatus).to.be.called.calledWithExactly(200);
  });

  it('getFields should return Shopify and Doppler fields', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'ae768b8c78d68a54565434',
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
      })
    );
    this.sandbox.stub(modulesMocks.dopplerClient, 'getFieldsAsync').returns(
      Promise.resolve([
        {
          name: 'FIRSTNAME',
          predefined: true,
          private: false,
          readonly: false,
          type: 'string',
        },
        {
          name: 'LASTNAME',
          predefined: true,
          private: false,
          readonly: false,
          type: 'string',
        },
      ])
    );

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.getFields(request, response);

    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com', true);
    expect(response.json.args[0][0].shopifyFields.length).to.be.eqls(32);
    expect(response.json.args[0][0].dopplerFields.length).to.be.eqls(2);
  });

  it('setFieldsMapping should store the fieldMapping in redis', async function() {
    const request = sinonMock.mockReq({
      session: { shop: 'store.myshopify.com' },
      body: {
        fieldsMapping: [
          { shopify: 'first_name', doppler: 'FIRSTNAME' },
          { shopify: 'last_name', doppler: 'LASTNAME' },
        ],
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.redisClient, 'storeShopAsync');

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.setFieldsMapping(request, response);

    expect(
      modulesMocks.redisClient.storeShopAsync
    ).to.be.called.calledWithExactly(
      'store.myshopify.com',
      {
        fieldsMapping:
          '[{"shopify":"first_name","doppler":"FIRSTNAME"},{"shopify":"last_name","doppler":"LASTNAME"}]',
      },
      true
    );
    expect(response.sendStatus).to.be.called.calledWithExactly(200);
  });

  it('synchronizeCustomers should perform the synchronization process', async function() {
    const request = sinonMock.mockReq({
      session: {
        accessToken: 'fb5d67a5bd67ab5d67ab5d',
        shop: 'store.myshopify.com',
      },
    });
    const response = sinonMock.mockRes();
    this.sandbox.stub(modulesMocks.shopifyClient.customer, 'list').returns(
      Promise.resolve([
        {
          id: 623558295613,
          email: 'jonsnow@example.com',
          first_name: 'Jon',
          last_name: 'Snow',
          default_address: {
            company: 'Winterfell',
          },
        },
        {
          id: 546813203473,
          email: 'nickrivers@example.com',
          first_name: 'Nick',
          last_name: 'Rivers',
          default_address: {
            company: 'Top Secret',
          },
        },
      ])
    );
    this.sandbox.stub(modulesMocks.redisClient, 'getShopAsync').returns(
      Promise.resolve({
        accessToken: 'ae768b8c78d68a54565434',
        dopplerApiKey: 'C22CADA13759DB9BBDF93B9D87C14D5A',
        dopplerAccountName: 'user@example.com',
        dopplerListId: 1456877,
        fieldsMapping:
          '[{"shopify":"first_name","doppler":"FIRSTNAME"},{"shopify":"last_name","doppler":"LASTNAME"}]',
      })
    );
    this.sandbox.stub(modulesMocks.redisClient, 'storeShopAsync');

    this.sandbox
      .stub(modulesMocks.dopplerClient, 'importSubscribersAsync')
      .returns(Promise.resolve('importTask-123456'));

    const appController = new AppController(
      redisClientFactoryStub,
      dopplerClientFactoryStub,
      shopifyClientFactoryStub
    );
    await appController.synchronizeCustomers(request, response);

    expect(modulesMocks.shopifyClient.customer.list).to.have.been.callCount(1);
    expect(
      modulesMocks.redisClient.getShopAsync
    ).to.be.called.calledWithExactly('store.myshopify.com');
    expect(
      modulesMocks.dopplerClient.importSubscribersAsync
    ).to.be.called.calledWithExactly(
      [
        {
          id: 623558295613,
          email: 'jonsnow@example.com',
          first_name: 'Jon',
          last_name: 'Snow',
          default_address: {
            company: 'Winterfell',
          },
        },
        {
          id: 546813203473,
          email: 'nickrivers@example.com',
          first_name: 'Nick',
          last_name: 'Rivers',
          default_address: {
            company: 'Top Secret',
          },
        },
      ],
      1456877,
      'store.myshopify.com',
      [
        { shopify: 'first_name', doppler: 'FIRSTNAME' },
        { shopify: 'last_name', doppler: 'LASTNAME' },
      ]
    );
    // TODO: mock the Date
    //expect(modulesMocks.redisClient.storeShopAsync).to.be.calledWithExactly('store.myshopify.com', { importTaskId: 'importTask-123456' }, true);
    expect(response.sendStatus).to.be.called.calledWithExactly(201);
  });
});