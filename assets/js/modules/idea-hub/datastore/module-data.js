/**
 * Module-data data store
 *
 * Site Kit by Google, Copyright 2021 Google LLC
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
import Data from 'googlesitekit-data';
import { MODULES_IDEA_HUB } from './constants';

const RECEIVE_IDEA_HUB_DATA = 'RECEIVE_IDEA_HUB_DATA';

const initialState = {
	lastIdeaPostUpdatedAt: undefined,
};

export const actions = {
	receiveIdeaHubData( ideaHubData ) {
		return {
			payload: ideaHubData,
			type: RECEIVE_IDEA_HUB_DATA,
		};
	},
};

export const controls = {};

export const reducer = ( state, { type, payload } ) => {
	switch ( type ) {
		case RECEIVE_IDEA_HUB_DATA: {
			const { lastIdeaPostUpdatedAt } = payload;
			return {
				...state,
				lastIdeaPostUpdatedAt,
			};
		}
		default: {
			return state;
		}
	}
};

export const resolvers = {
	*getLastIdeaPostUpdatedAt() {
		const { select } = yield Data.commonActions.getRegistry();

		if (
			select( MODULES_IDEA_HUB ).getLastIdeaPostUpdatedAt() !== undefined
		) {
			return;
		}

		if ( ! global._googlesitekitIdeaHub ) {
			global.console.error( ' Could not load modules/idea-hub data.' );
			return;
		}

		yield actions.receiveIdeaHubData( global._googlesitekitIdeaHub );
	},
};

export const selectors = {
	getLastIdeaPostUpdatedAt( state ) {
		const { lastIdeaPostUpdatedAt } = state;
		return lastIdeaPostUpdatedAt;
	},
};

export default {
	initialState,
	actions,
	controls,
	reducer,
	resolvers,
	selectors,
};
