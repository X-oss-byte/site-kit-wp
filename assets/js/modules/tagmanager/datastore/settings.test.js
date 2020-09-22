/**
 * modules/tagmanager data store: settings tests.
 *
 * Site Kit by Google, Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Internal dependencies
 */
import API from 'googlesitekit-api';
import { STORE_NAME, ACCOUNT_CREATE, CONTAINER_CREATE, CONTEXT_WEB, CONTEXT_AMP } from './constants';
import { STORE_NAME as CORE_SITE, AMP_MODE_SECONDARY, AMP_MODE_PRIMARY } from '../../../googlesitekit/datastore/site/constants';
import { STORE_NAME as CORE_MODULES } from '../../../googlesitekit/modules/datastore/constants';
import { STORE_NAME as MODULES_ANALYTICS } from '../../analytics/datastore/constants';
import defaultModules, * as modulesFixtures from '../../../googlesitekit/modules/datastore/__fixtures__';
import * as fixtures from './__fixtures__';
import { accountBuilder, containerBuilder, buildLiveContainerVersionWeb, buildLiveContainerVersionAMP } from './__factories__';
import {
	createTestRegistry,
	unsubscribeFromAll,
	muteFetch,
} from '../../../../../tests/js/utils';
import { getItem, setItem } from '../../../googlesitekit/api/cache';
import { createCacheKey } from '../../../googlesitekit/api';
import fetchMock from 'fetch-mock';
import { validateCanSubmitChanges } from './settings';
import { parseLiveContainerVersionIDs, createBuildAndReceivers } from './__factories__/utils';

describe( 'modules/tagmanager settings', () => {
	let registry;

	const validSettings = {
		accountID: '100',
		containerID: 'GTM-WEB1234',
		internalContainerID: '300',
		// ampContainerID: '',
		// internalAMPContainerID: '',
		useSnippet: true,
	};

	const validSettingsAMP = {
		accountID: '100',
		// containerID: '',
		// internalContainerID: '',
		ampContainerID: 'GTM-AMP1234',
		internalAMPContainerID: '399',
		useSnippet: true,
	};

	const WPError = {
		code: 'internal_error',
		message: 'Something wrong happened.',
		data: { status: 500 },
	};

	beforeAll( () => {
		API.setUsingCache( false );
	} );

	beforeEach( () => {
		registry = createTestRegistry();
		registry.dispatch( CORE_SITE ).receiveSiteInfo( {} );
	} );

	afterEach( () => {
		unsubscribeFromAll( registry );
	} );

	afterAll( () => {
		API.setUsingCache( true );
	} );

	function setPrimaryAMP() {
		registry.dispatch( CORE_SITE ).receiveSiteInfo( { ampMode: AMP_MODE_PRIMARY } );
	}
	function setSecondaryAMP() {
		registry.dispatch( CORE_SITE ).receiveSiteInfo( { ampMode: AMP_MODE_SECONDARY } );
	}

	describe( 'actions', () => {
		beforeEach( () => {
			// Receive empty settings to prevent unexpected fetch by resolver.
			registry.dispatch( STORE_NAME ).receiveGetSettings( {} );
		} );

		describe( 'submitChanges', () => {
			describe( 'with no AMP', () => {
				it( 'dispatches createContainer if the "set up a new container" option is chosen', async () => {
					registry.dispatch( STORE_NAME ).setSettings( {
						...validSettings,
						accountID: '12345',
						containerID: CONTAINER_CREATE,
					} );
					const createdContainer = {
						...fixtures.createContainer,
					};

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{ body: createdContainer, status: 200 }
					);
					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						( url, opts ) => {
							const { data } = JSON.parse( opts.body );
							// Return the same settings passed to the API.
							return { body: data, status: 200 };
						}
					);

					const result = await registry.dispatch( STORE_NAME ).submitChanges();

					expect( fetchMock ).toHaveFetched(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{
							body: {
								data: { accountID: '12345', usageContext: CONTEXT_WEB },
							},
						}
					);

					expect( result.error ).toBeFalsy();
					expect( registry.select( STORE_NAME ).getContainerID() ).toBe( createdContainer.publicId );
					expect( registry.select( STORE_NAME ).getInternalContainerID() ).toBe( createdContainer.containerId );
				} );

				it( 'handles an error if set while creating a container', async () => {
					registry.dispatch( STORE_NAME ).setSettings( {
						...validSettings,
						accountID: '12345',
						containerID: CONTAINER_CREATE,
					} );

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{ body: WPError, status: 500 }
					);

					await registry.dispatch( STORE_NAME ).submitChanges();

					expect( fetchMock ).toHaveFetched(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{
							body: {
								data: { accountID: '12345', usageContext: CONTEXT_WEB },
							},
						}
					);

					expect( registry.select( STORE_NAME ).getContainerID() ).toBe( CONTAINER_CREATE );
					expect( registry.select( STORE_NAME ).getErrorForAction( 'submitChanges' ) ).toEqual( WPError );
					expect( console ).toHaveErrored();
				} );

				it( 'dispatches saveSettings', async () => {
					registry.dispatch( STORE_NAME ).setSettings( validSettings );

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						{ body: validSettings, status: 200 }
					);

					await registry.dispatch( STORE_NAME ).submitChanges();

					expect( fetchMock ).toHaveFetched(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						{
							body: { data: validSettings },
						}
					);

					expect( registry.select( STORE_NAME ).haveSettingsChanged() ).toBe( false );
				} );

				it( 'returns an error if saveSettings fails', async () => {
					registry.dispatch( STORE_NAME ).setSettings( validSettings );

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						{ body: WPError, status: 500 }
					);

					const result = await registry.dispatch( STORE_NAME ).submitChanges();

					expect( fetchMock ).toHaveFetched(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						{
							body: { data: validSettings },
						}
					);
					expect( result.error ).toEqual( WPError );
					expect( console ).toHaveErrored();
				} );

				it( 'invalidates module cache on success', async () => {
					registry.dispatch( STORE_NAME ).setSettings( validSettings );

					muteFetch( /^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/ );
					const cacheKey = createCacheKey( 'modules', 'tagmanager', 'arbitrary-datapoint' );
					expect( await setItem( cacheKey, 'test-value' ) ).toBe( true );
					expect( ( await getItem( cacheKey ) ).value ).not.toBeFalsy();

					await registry.dispatch( STORE_NAME ).submitChanges();

					expect( ( await getItem( cacheKey ) ).value ).toBeFalsy();
				} );
			} );

			describe( 'with primary AMP', () => {
				beforeEach( () => setPrimaryAMP() );

				it( 'dispatches createContainer if the "set up a new container" option is chosen', async () => {
					registry.dispatch( STORE_NAME ).setSettings( {
						...validSettings,
						accountID: '12345',
						ampContainerID: CONTAINER_CREATE,
					} );
					const createdAMPContainer = containerBuilder( { accountId: '12345', usageContext: [ CONTEXT_AMP ] } );

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{ body: createdAMPContainer, status: 200 }
					);

					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						( url, opts ) => {
							const { data } = JSON.parse( opts.body );
							// Return the same settings passed to the API.
							return { body: data, status: 200 };
						}
					);

					await registry.dispatch( STORE_NAME ).submitChanges();

					expect( fetchMock ).toHaveFetched(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
						{
							body: {
								data: { accountID: '12345', usageContext: CONTEXT_AMP },
							},
						}
					);

					expect( registry.select( STORE_NAME ).getAMPContainerID() ).toBe( createdAMPContainer.publicId );
				} );
			} );

			describe( 'with secondary AMP', () => {
				beforeEach( () => setSecondaryAMP() );

				it( 'dispatches createContainer for both web and AMP containers when selected', async () => {
					const account = accountBuilder();
					registry.dispatch( STORE_NAME ).setSettings( {
						...validSettings,
						containerID: CONTAINER_CREATE,
						ampContainerID: CONTAINER_CREATE,
					} );
					const createdWebContainer = containerBuilder( { accountId: account.accountId, usageContext: [ CONTEXT_WEB ] } );
					const createdAMPContainer = containerBuilder( { accountId: account.accountId, usageContext: [ CONTEXT_AMP ] } );

					fetchMock.postOnce(
						{
							url: /^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
							body: { data: { usageContext: CONTEXT_WEB } },
						},
						{ body: createdWebContainer, status: 200 },
						{ matchPartialBody: true }
					);
					fetchMock.postOnce(
						{
							url: /^\/google-site-kit\/v1\/modules\/tagmanager\/data\/create-container/,
							body: { data: { usageContext: CONTEXT_AMP } },
						},
						{ body: createdAMPContainer, status: 200 },
						{ matchPartialBody: true }
					);
					fetchMock.postOnce(
						/^\/google-site-kit\/v1\/modules\/tagmanager\/data\/settings/,
						( url, opts ) => {
							const { data } = JSON.parse( opts.body );
							// Return the same settings passed to the API.
							return { body: data, status: 200 };
						}
					);

					const { error } = await registry.dispatch( STORE_NAME ).submitChanges();

					expect( error ).toBe( undefined );
					expect( registry.select( STORE_NAME ).getContainerID() ).toBe( createdWebContainer.publicId );
					expect( registry.select( STORE_NAME ).getAMPContainerID() ).toBe( createdAMPContainer.publicId );
				} );
			} );
		} );
	} );

	describe( 'selectors', () => {
		describe( 'isDoingSubmitChanges', () => {
			it( 'returns true while submitting changes', async () => {
				registry.dispatch( STORE_NAME ).receiveGetSettings( validSettings );

				expect( registry.select( STORE_NAME ).haveSettingsChanged() ).toBe( false );
				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( false );

				const promise = registry.dispatch( STORE_NAME ).submitChanges();

				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( true );

				await promise;

				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( false );
			} );
		} );

		describe( 'canSubmitChanges', () => {
			describe( 'with no AMP', () => {
				beforeEach( () => {
					const { accountID, internalContainerID } = validSettings;
					registry.dispatch( CORE_SITE ).receiveSiteInfo( { ampMode: false } );
					registry.dispatch( STORE_NAME ).setSettings( validSettings );
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
					registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion( fixtures.liveContainerVersion, { accountID, internalContainerID } );
					registry.dispatch( CORE_MODULES ).receiveGetModules( defaultModules );
				} );

				it( 'requires a valid accountID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setAccountID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid accountID is required to submit changes' );
				} );

				it( 'requires a valid containerID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid containerID selection is required to submit changes' );
				} );

				it( 'requires a valid internal container ID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setInternalContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid internalContainerID is required to submit changes' );
				} );

				it( 'requires permissions for an existing tag when present', () => {
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( validSettings.containerID );
					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: true }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: false }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'existing tag permission is required to submit changes' );
				} );

				it( 'supports creating a web container', () => {
					registry.dispatch( STORE_NAME ).setContainerID( CONTAINER_CREATE );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
				} );

				it( 'does not support creating an account', () => {
					registry.dispatch( STORE_NAME ).setAccountID( ACCOUNT_CREATE );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
				} );

				it( 'requires Analytics propertyID setting to match the propertyID in the web container', () => {
					const modules = modulesFixtures.withActive( 'analytics' );
					registry.dispatch( CORE_MODULES ).receiveGetModules( modules );
					registry.dispatch( MODULES_ANALYTICS ).receiveGetSettings( { propertyID: '' } );
					const liveContainerVersion = buildLiveContainerVersionWeb( { propertyID: 'UA-12345-1' } );
					parseLiveContainerVersionIDs( liveContainerVersion, ( { accountID, containerID, internalContainerID } ) => {
						registry.dispatch( STORE_NAME ).setSettings( { ...validSettings, accountID, containerID, internalContainerID } );
						registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion( liveContainerVersion, { accountID, internalContainerID } );
					} );

					// No property ID set in Analytics
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Matching property ID in Analytics and GTM
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-12345-1' );
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Non-matching property IDs
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-99999-9' );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'single GTM Analytics property ID must match Analytics property ID' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
				} );
			} );

			describe( 'with primary AMP', () => {
				beforeEach( () => {
					setPrimaryAMP();
					const { accountID, internalAMPContainerID: internalContainerID } = validSettingsAMP;
					registry.dispatch( STORE_NAME ).setSettings( validSettingsAMP );
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
					registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion( fixtures.liveContainerVersion, { accountID, internalContainerID } );
					registry.dispatch( CORE_MODULES ).receiveGetModules( defaultModules );
				} );

				it( 'requires a valid accountID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setAccountID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid accountID is required to submit changes' );
				} );

				it( 'requires a valid AMP containerID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					// Invalid web container ID is allowed (although technically not possible).
					registry.dispatch( STORE_NAME ).setContainerID( '0' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setAMPContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid ampContainerID selection is required to submit changes' );
				} );

				it( 'requires a valid internal AMP container ID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					// Invalid internal web container ID is allowed (although technically not possible).
					registry.dispatch( STORE_NAME ).setInternalContainerID( '0' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setInternalAMPContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid internalAMPContainerID is required to submit changes' );
				} );

				it( 'supports creating an AMP container', () => {
					registry.dispatch( STORE_NAME ).setAMPContainerID( CONTAINER_CREATE );
					registry.dispatch( STORE_NAME ).setInternalAMPContainerID( '' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
				} );

				it( 'requires permissions for an existing tag when present', () => {
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( validSettings.containerID );
					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: true }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: false }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'existing tag permission is required to submit changes' );
				} );

				it( 'does not support creating an account', () => {
					registry.dispatch( STORE_NAME ).setAccountID( ACCOUNT_CREATE );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid accountID is required to submit changes' );
				} );

				it( 'requires Analytics propertyID setting to match the propertyID in the AMP container', () => {
					const modules = modulesFixtures.withActive( 'analytics' );
					registry.dispatch( CORE_MODULES ).receiveGetModules( modules );
					registry.dispatch( MODULES_ANALYTICS ).receiveGetSettings( { propertyID: '' } );
					const liveContainerVersion = buildLiveContainerVersionAMP( { propertyID: 'UA-12345-1' } );
					parseLiveContainerVersionIDs( liveContainerVersion, ( { accountID, internalContainerID, ampContainerID, internalAMPContainerID } ) => {
						registry.dispatch( STORE_NAME ).setSettings( { ...validSettings, accountID, ampContainerID, internalAMPContainerID } );
						registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion( liveContainerVersion, { accountID, internalContainerID } );
					} );

					// No property ID set in Analytics
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Matching property ID in Analytics and GTM
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-12345-1' );
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Non-matching property IDs
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-99999-9' );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'single GTM Analytics property ID must match Analytics property ID' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
				} );
			} );

			describe( 'with secondary AMP', () => {
				beforeEach( () => {
					setSecondaryAMP();
					registry.dispatch( STORE_NAME ).setSettings( {
						...validSettings,
						...validSettingsAMP,
					} );
					const { accountID, internalContainerID } = validSettings;
					const { internalAMPContainerID } = validSettingsAMP;
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
					registry.dispatch( CORE_MODULES ).receiveGetModules( defaultModules );
					registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion(
						fixtures.liveContainerVersions.web.noGAWithVariable,
						{ accountID, internalContainerID }
					);
					registry.dispatch( STORE_NAME ).receiveGetLiveContainerVersion(
						fixtures.liveContainerVersions.amp.noGA,
						{ accountID, internalContainerID: internalAMPContainerID }
					);
				} );

				it( 'requires a valid accountID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setAccountID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid accountID is required to submit changes' );
				} );

				it( 'requires valid containerID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid containerID selection is required to submit changes' );
				} );

				it( 'requires a valid AMP containerID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setAMPContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid ampContainerID selection is required to submit changes' );
				} );

				it( 'requires a valid internal container ID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setInternalContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid internalContainerID is required to submit changes' );
				} );

				it( 'requires a valid internal AMP container ID', () => {
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).setInternalAMPContainerID( '0' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid internalAMPContainerID is required to submit changes' );
				} );

				it( 'supports creating a web container', () => {
					registry.dispatch( STORE_NAME ).setContainerID( CONTAINER_CREATE );
					registry.dispatch( STORE_NAME ).setInternalContainerID( '' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
				} );

				it( 'supports creating an AMP container', () => {
					registry.dispatch( STORE_NAME ).setAMPContainerID( CONTAINER_CREATE );
					registry.dispatch( STORE_NAME ).setInternalAMPContainerID( '' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
				} );

				it( 'supports creating an AMP container and a web container', () => {
					registry.dispatch( STORE_NAME ).setContainerID( CONTAINER_CREATE );
					registry.dispatch( STORE_NAME ).setInternalContainerID( '' );
					registry.dispatch( STORE_NAME ).setAMPContainerID( CONTAINER_CREATE );
					registry.dispatch( STORE_NAME ).setInternalAMPContainerID( '' );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
				} );

				it( 'requires permissions for an existing tag when present', () => {
					registry.dispatch( STORE_NAME ).receiveGetExistingTag( validSettings.containerID );
					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: true }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					registry.dispatch( STORE_NAME ).receiveGetTagPermission( { permission: false }, { containerID: validSettings.containerID } );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'existing tag permission is required to submit changes' );
				} );

				it( 'does not support creating an account', () => {
					registry.dispatch( STORE_NAME ).setAccountID( ACCOUNT_CREATE );

					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'a valid accountID is required to submit changes' );
				} );

				it( 'requires both containers to reference the same propertyID when an Analytics tag is present', () => {
					registry.dispatch( MODULES_ANALYTICS ).receiveGetSettings( { propertyID: '' } );
					const { buildAndReceiveWebAndAMP } = createBuildAndReceivers( registry );

					// Matching property IDs
					buildAndReceiveWebAndAMP( { webPropertyID: 'UA-12345-1', ampPropertyID: 'UA-12345-1' } );
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

					// Non-matching property IDs
					buildAndReceiveWebAndAMP( { webPropertyID: 'UA-12345-1', ampPropertyID: 'UA-12345-99' } );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'containers with Analytics tags must reference a single property ID to submit changes' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
				} );

				it( 'requires Analytics propertyID setting to match the propertyID in both containers', () => {
					const modules = modulesFixtures.withActive( 'analytics' );
					registry.dispatch( CORE_MODULES ).receiveGetModules( modules );
					registry.dispatch( MODULES_ANALYTICS ).receiveGetSettings( { propertyID: '' } );
					const { buildAndReceiveWebAndAMP } = createBuildAndReceivers( registry );
					buildAndReceiveWebAndAMP( { webPropertyID: 'UA-12345-1', ampPropertyID: 'UA-12345-1' } );

					// This test only checks matching between the singular propertyID in containers
					// and the Analytics propertyID setting. This is because the check for
					// multiple property IDs (non-matching IDs between containers) happens before this
					// and results in a different validation error (see above).

					// No property ID set in Analytics
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Matching property ID in Analytics and GTM
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-12345-1' );
					validateCanSubmitChanges( registry.select );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
					// Non-matching property IDs
					registry.dispatch( MODULES_ANALYTICS ).setPropertyID( 'UA-99999-9' );
					expect( () => validateCanSubmitChanges( registry.select ) )
						.toThrow( 'single GTM Analytics property ID must match Analytics property ID' );
					expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
				} );
			} );
		} );
	} );
} );
