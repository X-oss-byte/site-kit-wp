/**
 * Site Kit by Google, Copyright 2023 Google LLC
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
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';

/**
 * Internal dependencies
 */
import ViewedStateObserver from './ViewedStateObserver';
import { trackEvent } from '../../../../util';
import { useHasBeenViewed } from '../useHasBeenViewed';

export default function Notification( {
	className,
	type,
	id,
	eventCategory,
	children,
} ) {
	const ref = useRef();
	const viewed = useHasBeenViewed( id );

	// Track view once.
	useEffect( () => {
		if ( viewed ) {
			trackEvent( eventCategory, 'view_notification' );
		}
	}, [ viewed, eventCategory ] );

	return (
		<div
			ref={ ref }
			className={ classnames(
				'googlesitekit-notification',
				`googlesitekit-notification--${ type }`,
				className
			) }
		>
			{ children }
			{ /* Encapsulate observer to dispose when no longer needed. */ }
			{ ! viewed && (
				<ViewedStateObserver observeRef={ ref } threshold={ 0.5 } />
			) }
		</div>
	);
}
