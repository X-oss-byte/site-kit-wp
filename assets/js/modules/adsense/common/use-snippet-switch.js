/**
 * AdSense Use Snippet Switch component.
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
 * External dependencies
 */
import PropTypes from 'prop-types';

/**
 * WordPress dependencies
 */
import { useCallback, Fragment } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Data from 'googlesitekit-data';
import Switch from '../../../components/switch';
import SettingsNotice from '../../../components/settings-notice';
import { trackEvent } from '../../../util';
import { STORE_NAME } from '../datastore';
const { useSelect, useDispatch } = Data;

export default function UseSnippetSwitch( props ) {
	const {
		label = __( 'Let Site Kit place code on your site', 'google-site-kit' ),
		checkedMessage,
		uncheckedMessage,
		saveOnChange,
	} = props;

	const useSnippet = useSelect( ( select ) => select( STORE_NAME ).getUseSnippet() );
	const isDoingSaveUseSnippet = useSelect( ( select ) => select( STORE_NAME ).isDoingSaveUseSnippet() );

	const { setUseSnippet, saveUseSnippet } = useDispatch( STORE_NAME );
	const onChange = useCallback( async () => {
		setUseSnippet( ! useSnippet );
		trackEvent( 'adsense_setup', useSnippet ? 'adsense_tag_enabled' : 'adsense_tag_disabled' );
		if ( saveOnChange ) {
			await saveUseSnippet();
		}
	}, [ useSnippet ] );

	if ( undefined === useSnippet ) {
		return null;
	}

	return (
		<Fragment>
			<div className="googlesitekit-setup-module__switch">
				<Switch
					label={ label }
					onClick={ onChange }
					checked={ useSnippet }
					disabled={ isDoingSaveUseSnippet }
					hideLabel={ false }
				/> <span className="googlesitekit-recommended">{ __( 'RECOMMENDED', 'google-site-kit' ) }</span>
			</div>
			{ useSnippet && checkedMessage &&
				<SettingsNotice
					message={ checkedMessage }
				/>
			}
			{ ! useSnippet && uncheckedMessage &&
				<SettingsNotice
					message={ uncheckedMessage }
				/>
			}
		</Fragment>
	);
}

UseSnippetSwitch.propTypes = {
	label: PropTypes.string,
	checkedMessage: PropTypes.string,
	uncheckedMessage: PropTypes.string,
	saveOnChange: PropTypes.bool,
};

UseSnippetSwitch.defaultProps = {
	saveOnChange: false,
};
