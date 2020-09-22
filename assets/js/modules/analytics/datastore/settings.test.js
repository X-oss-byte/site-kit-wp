/**
 * modules/analytics data store: settings tests.
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
import { STORE_NAME, FORM_SETUP, ACCOUNT_CREATE, PROPERTY_CREATE, PROFILE_CREATE } from './constants';
import { STORE_NAME as CORE_FORMS } from '../../../googlesitekit/datastore/forms';
import { STORE_NAME as CORE_SITE, AMP_MODE_SECONDARY } from '../../../googlesitekit/datastore/site/constants';
import { STORE_NAME as CORE_MODULES } from '../../../googlesitekit/modules/datastore/constants';
import * as fixtures from './__fixtures__';
import {
	createTestRegistry,
	subscribeUntil,
	unsubscribeFromAll,
} from '../../../../../tests/js/utils';
import { getItem, setItem } from '../../../googlesitekit/api/cache';
import { createCacheKey } from '../../../googlesitekit/api';
import { createBuildAndReceivers } from '../../tagmanager/datastore/__factories__/utils';

describe( 'modules/analytics settings', () => {
	let registry;

	const validSettings = {
		accountID: '12345',
		propertyID: 'UA-12345-1',
		internalWebPropertyID: '23245',
		profileID: '54321',
		useSnippet: true,
		trackingDisabled: [],
		anonymizeIP: true,
	};
	const tagWithPermission = {
		accountID: '12345',
		propertyID: 'UA-12345-1',
		permission: true,
	};
	const error = {
		code: 'internal_error',
		message: 'Something wrong happened.',
		data: { status: 500 },
	};

	beforeAll( () => {
		API.setUsingCache( false );
	} );

	beforeEach( () => {
		registry = createTestRegistry();
		registry.dispatch( CORE_MODULES ).receiveGetModules( [
			{
				slug: 'tagmanager',
				name: 'Tag Manager',
				description: 'Tag Manager creates an easy to manage way to create tags on your site without updating code.',
				homepage: 'https://tagmanager.google.com/',
				internal: false,
				active: false,
				connected: false,
				dependencies: [ 'analytics' ],
				dependants: [],
				order: 10,
			},
		] );
	} );

	afterAll( () => {
		API.setUsingCache( true );
	} );

	afterEach( () => {
		unsubscribeFromAll( registry );
	} );

	describe( 'actions', () => {
		beforeEach( () => {
			// Receive empty settings to prevent unexpected fetch by resolver.
			registry.dispatch( STORE_NAME ).receiveGetSettings( {} );
		} );

		describe( 'submitChanges', () => {
			it( 'dispatches createProperty if the "set up a new property" option is chosen', async () => {
				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					accountID: '12345',
					propertyID: PROPERTY_CREATE,
				} );
				const createdProperty = {
					...fixtures.propertiesProfiles.properties[ 0 ],
					id: 'UA-12345-1',
					internalWebPropertyId: '123456789',
				};

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-property/,
					{ body: createdProperty, status: 200 }
				);
				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					( url, opts ) => {
						const { data } = JSON.parse( opts.body );
						// Return the same settings passed to the API.
						return { body: data, status: 200 };
					}
				);

				const result = await registry.dispatch( STORE_NAME ).submitChanges();
				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-property/,
					{ body: { data: { accountID: '12345' } } },
				);

				expect( result.error ).toBeFalsy();
				expect( registry.select( STORE_NAME ).getPropertyID() ).toBe( createdProperty.id );
				expect( registry.select( STORE_NAME ).getInternalWebPropertyID() ).toBe( createdProperty.internalWebPropertyId );
			} );

			it( 'handles an error if set while creating a property', async () => {
				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					accountID: '12345',
					propertyID: PROPERTY_CREATE,
				} );

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-property/,
					{ body: error, status: 500 }
				);

				await registry.dispatch( STORE_NAME ).submitChanges();

				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-property/,
					{ body: { data: { accountID: '12345' } } },
				);

				expect( registry.select( STORE_NAME ).getPropertyID() ).toBe( PROPERTY_CREATE );
				expect( registry.select( STORE_NAME ).getErrorForAction( 'submitChanges' ) ).toEqual( error );
				expect( console ).toHaveErrored();
			} );

			it( 'dispatches createProfile if the "set up a new profile" option is chosen', async () => {
				const profileName = fixtures.createProfile.name;
				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					accountID: '12345',
					propertyID: 'UA-12345-1',
					profileID: PROFILE_CREATE,
				} );
				registry.dispatch( CORE_FORMS ).setValues( FORM_SETUP, {
					profileName,
				} );
				const createdProfile = {
					...fixtures.propertiesProfiles.profiles[ 0 ],
					id: '987654321',
				};
				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-profile/,
					{ body: createdProfile, status: 200 }
				);
				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					( url, opts ) => {
						const { data } = JSON.parse( opts.body );
						// Return the same settings passed to the API.
						return { body: data, status: 200 };
					}
				);

				await registry.dispatch( STORE_NAME ).submitChanges();

				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-profile/,
					{
						body: {
							data: {
								accountID: '12345',
								propertyID: 'UA-12345-1',
								profileName,
							},
						},
					},
				);

				expect( registry.select( STORE_NAME ).getProfileID() ).toBe( createdProfile.id );
			} );

			it( 'handles an error if set while creating a profile', async () => {
				const profileName = fixtures.createProfile.name;

				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					accountID: '12345',
					propertyID: 'UA-12345-1',
					profileID: PROFILE_CREATE,
				} );

				registry.dispatch( CORE_FORMS ).setValues( FORM_SETUP, {
					profileName,
				} );

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-profile/,
					{ body: error, status: 500 }
				);

				const result = await registry.dispatch( STORE_NAME ).submitChanges();

				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-profile/,
					{
						body: {
							data: {
								accountID: '12345',
								propertyID: 'UA-12345-1',
								profileName,
							},
						},
					},
				);
				expect( result.error ).toEqual( error );
				expect( registry.select( STORE_NAME ).getProfileID() ).toBe( PROFILE_CREATE );
				expect( registry.select( STORE_NAME ).getErrorForAction( 'submitChanges' ) ).toEqual( error );
				expect( console ).toHaveErrored();
			} );

			it( 'dispatches both createProperty and createProfile when selected', async () => {
				const profileName = fixtures.createProfile.name;
				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					accountID: '12345',
					propertyID: PROPERTY_CREATE,
					profileID: PROFILE_CREATE,
				} );
				registry.dispatch( CORE_FORMS ).setValues( FORM_SETUP, {
					profileName,
				} );
				const createdProperty = {
					...fixtures.propertiesProfiles.properties[ 0 ],
					id: 'UA-12345-1',
				};
				const createdProfile = {
					...fixtures.propertiesProfiles.profiles[ 0 ],
					id: '987654321',
				};

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-property/,
					{ body: createdProperty, status: 200 }
				);
				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/create-profile/,
					{ body: createdProfile, status: 200 }
				);
				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					( url, opts ) => {
						const { data } = JSON.parse( opts.body );
						// Return the same settings passed to the API.
						return { body: data, status: 200 };
					}
				);

				await registry.dispatch( STORE_NAME ).submitChanges();

				expect( registry.select( STORE_NAME ).getPropertyID() ).toBe( createdProperty.id );
				expect( registry.select( STORE_NAME ).getProfileID() ).toBe( createdProfile.id );
			} );

			it( 'dispatches saveSettings', async () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					{ body: validSettings, status: 200 }
				);

				await registry.dispatch( STORE_NAME ).submitChanges();

				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					{ body: { data: validSettings } },
				);
				expect( registry.select( STORE_NAME ).haveSettingsChanged() ).toBe( false );
			} );

			it( 'returns an error if saveSettings fails', async () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					{ body: error, status: 500 }
				);

				const result = await registry.dispatch( STORE_NAME ).submitChanges();

				expect( fetchMock ).toHaveFetched(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					{ body: { data: validSettings } },
				);
				expect( result.error ).toEqual( error );
				expect( console ).toHaveErrored();
			} );

			it( 'invalidates Analytics API cache on success', async () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );

				fetchMock.postOnce(
					/^\/google-site-kit\/v1\/modules\/analytics\/data\/settings/,
					{ body: validSettings, status: 200 }
				);

				const cacheKey = createCacheKey( 'modules', 'analytics', 'arbitrary-datapoint' );
				expect( await setItem( cacheKey, 'test-value' ) ).toBe( true );
				expect( ( await getItem( cacheKey ) ).value ).not.toBeFalsy();

				await registry.dispatch( STORE_NAME ).submitChanges();

				expect( ( await getItem( cacheKey ) ).value ).toBeFalsy();
			} );
		} );
	} );

	describe( 'selectors', () => {
		describe( 'isDoingSubmitChanges', () => {
			it( 'sets internal state while submitting changes', async () => {
				registry.dispatch( STORE_NAME ).receiveGetSettings( validSettings );
				expect( registry.select( STORE_NAME ).haveSettingsChanged() ).toBe( false );

				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( false );

				registry.dispatch( STORE_NAME ).submitChanges();

				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( true );

				await subscribeUntil( registry,
					() => registry.stores[ STORE_NAME ].store.getState().isDoingSubmitChanges === false
				);

				expect( registry.select( STORE_NAME ).isDoingSubmitChanges() ).toBe( false );
			} );
		} );

		describe( 'canSubmitChanges', () => {
			it( 'requires a valid accountID', () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( tagWithPermission.propertyID );
				registry.dispatch( STORE_NAME ).receiveGetTagPermission( tagWithPermission, { propertyID: tagWithPermission.propertyID } );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

				registry.dispatch( STORE_NAME ).setAccountID( '0' );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );

			it( 'requires a valid propertyID', () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( tagWithPermission.propertyID );
				registry.dispatch( STORE_NAME ).receiveGetTagPermission( tagWithPermission, { propertyID: tagWithPermission.propertyID } );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

				registry.dispatch( STORE_NAME ).setPropertyID( '0' );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );

			it( 'requires a valid profileID', () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( tagWithPermission.propertyID );
				registry.dispatch( STORE_NAME ).receiveGetTagPermission( tagWithPermission, { propertyID: tagWithPermission.propertyID } );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

				registry.dispatch( STORE_NAME ).setProfileID( '0' );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );

			it( 'requires permission for GTM Analytics tag if the tag is present', () => {
				const data = {
					accountID: '12345',
					webPropertyID: 'UA-123456789-1',
					ampPropertyID: 'UA-123456789-1',
				};

				registry.dispatch( CORE_MODULES ).receiveGetModules( [
					{
						slug: 'tagmanager',
						name: 'Tag Manager',
						description: 'Tag Manager creates an easy to manage way to create tags on your site without updating code.',
						homepage: 'https://tagmanager.google.com/',
						internal: false,
						active: true,
						connected: true,
						dependencies: [ 'analytics' ],
						dependants: [],
						order: 10,
					},
				] );

				registry.dispatch( CORE_SITE ).receiveSiteInfo( { ampMode: AMP_MODE_SECONDARY } );
				registry.dispatch( STORE_NAME ).receiveGetTagPermission( {
					accountID: data.accountID,
					permission: false,
				}, { propertyID: data.webPropertyID } );

				const { buildAndReceiveWebAndAMP } = createBuildAndReceivers( registry );
				buildAndReceiveWebAndAMP( data );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );

			it( 'requires permissions for an existing tag', () => {
				const existingTag = {
					accountID: '999999',
					propertyID: 'UA-999999-1',
				};
				registry.dispatch( STORE_NAME ).setSettings( {
					...validSettings,
					...existingTag, // Set automatically in resolver.
				} );
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( existingTag.propertyID );
				registry.dispatch( STORE_NAME ).receiveGetTagPermission( {
					accountID: existingTag.accountID,
					permission: true,
				}, { propertyID: existingTag.propertyID } );
				expect( registry.select( STORE_NAME ).hasTagPermission( existingTag.propertyID ) ).toBe( true );
				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );

				registry.dispatch( STORE_NAME ).receiveGetTagPermission( {
					accountID: existingTag.accountID,
					permission: false,
				}, { propertyID: existingTag.propertyID } );
				expect( registry.select( STORE_NAME ).hasTagPermission( existingTag.propertyID ) ).toBe( false );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );

			it( 'supports creating a property', () => {
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).setPropertyID( PROPERTY_CREATE );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( true );
			} );

			it( 'supports creating a profile', () => {
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).setProfileID( PROFILE_CREATE );
				registry.dispatch( CORE_FORMS ).setValues( FORM_SETUP, { profileName: 'all web site data' } );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBeTruthy();
			} );

			it( 'should not support creating a new profile when the profile name is empty', () => {
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).setProfileID( PROFILE_CREATE );
				registry.dispatch( CORE_FORMS ).setValues( FORM_SETUP, { profileName: '' } );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBeFalsy();
			} );

			it( 'should not support creating a new profile when the profile name is not set at all', () => {
				registry.dispatch( STORE_NAME ).receiveGetExistingTag( null );
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).setProfileID( PROFILE_CREATE );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBeFalsy();
			} );

			it( 'does not support creating an account', () => {
				registry.dispatch( STORE_NAME ).setSettings( validSettings );
				registry.dispatch( STORE_NAME ).setAccountID( ACCOUNT_CREATE );

				expect( registry.select( STORE_NAME ).canSubmitChanges() ).toBe( false );
			} );
		} );
	} );
} );
