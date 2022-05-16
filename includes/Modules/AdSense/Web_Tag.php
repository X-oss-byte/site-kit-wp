<?php
/**
 * Class Google\Site_Kit\Modules\AdSense\Web_Tag
 *
 * @package   Google\Site_Kit\Modules\AdSense
 * @copyright 2021 Google LLC
 * @license   https://www.apache.org/licenses/LICENSE-2.0 Apache License 2.0
 * @link      https://sitekit.withgoogle.com
 */

namespace Google\Site_Kit\Modules\AdSense;

use Google\Site_Kit\Core\Modules\Tags\Module_Web_Tag;
use Google\Site_Kit\Core\Util\Method_Proxy_Trait;
use Google\Site_Kit\Core\Tags\Tag_With_DNS_Prefetch_Trait;
use Google\Site_Kit\Core\Util\BC_Functions;

/**
 * Class for Web tag.
 *
 * @since 1.24.0
 * @access private
 * @ignore
 */
class Web_Tag extends Module_Web_Tag {

	use Method_Proxy_Trait, Tag_With_DNS_Prefetch_Trait;

	/**
	 * Registers tag hooks.
	 *
	 * @since 1.24.0
	 */
	public function register() {
		add_action( 'wp_head', $this->get_method_proxy_once( 'render' ) );

		add_filter(
			'wp_resource_hints',
			$this->get_dns_prefetch_hints_callback( '//pagead2.googlesyndication.com' ),
			10,
			2
		);

		$this->do_init_tag_action();
	}

	/**
	 * Gets the AdSense script tag attributes.
	 *
	 * @since n.e.x.t
	 *
	 * @return array Array of attributes.
	 */
	private function get_tag_attributes() {
		// If we haven't completed the account connection yet, we still insert the AdSense tag
		// because it is required for account verification.

		$adsense_script_src = sprintf(
			'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=%s',
			esc_attr( $this->tag_id )
		);

		$adsense_script_attributes = array(
			'async'       => true,
			'src'         => $adsense_script_src,
			'crossorigin' => 'anonymous',
		);

		$adsense_attributes = $this->get_tag_blocked_on_consent_attribute_array();

		$auto_ads_opt = array();

		$auto_ads_opt_filtered = apply_filters( 'googlesitekit_auto_ads_opt', $auto_ads_opt, $this->tag_id );

		if ( is_array( $auto_ads_opt_filtered ) && ! empty( $auto_ads_opt_filtered ) ) {
			$strip_attributes = array(
				'google_ad_client'      => '',
				'enable_page_level_ads' => '',
			);

			$auto_ads_opt_filtered = array_diff_key( $auto_ads_opt_filtered, $strip_attributes );

			$auto_ads_opt_sanitized = array();

			foreach ( $auto_ads_opt_filtered as $key => $value ) {
				$new_key  = 'data-';
				$new_key .= str_replace( '_', '-', $key );

				$auto_ads_opt_sanitized[ $new_key ] = $value;
			}

			$adsense_attributes = array_merge( $adsense_attributes, $auto_ads_opt_sanitized );
		}
		return array_merge( $adsense_script_attributes, $adsense_attributes );
	}

	/**
	 * Outputs the AdSense script tag.
	 *
	 * @since 1.24.0
	 */
	protected function render() {
		printf( "\n<!-- %s -->\n", esc_html__( 'Google AdSense snippet added by Site Kit', 'google-site-kit' ) );
		BC_Functions::wp_print_script_tag( $this->get_tag_attributes() );
		printf( "\n<!-- %s -->\n", esc_html__( 'End Google AdSense snippet added by Site Kit', 'google-site-kit' ) );
	}

	/**
	 * Gets the adsense script tag.
	 *
	 * @since n.e.x.t
	 *
	 * @return string Gets the AdSense snippet to render via a REST endpoint.
	 */
	public function filter_rest_tags() {
		$snippet_comment_begin = sprintf( "\n<!-- %s -->\n", esc_html__( 'Google AdSense snippet added by Site Kit', 'google-site-kit' ) );
		$tag                   = BC_Functions::wp_get_script_tag( $this->get_tag_attributes() );
		$snippet_comment_end   = sprintf( "\n<!-- %s -->\n", esc_html__( 'End Google AdSense snippet added by Site Kit', 'google-site-kit' ) );
		return $snippet_comment_begin . $tag . $snippet_comment_end;
	}

}
