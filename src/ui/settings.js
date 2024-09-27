// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2021 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import { VERSION } from '../shared/version.js';
import { PACKAGE_ID, PACKAGE_TITLE } from '../consts.js';
import { LibWrapperStats } from './stats.js';
import { WRAPPERS } from '../lib/storage.js';
import { PackageInfo, PACKAGE_TYPES } from '../shared/package_info.js';
import { i18n } from '../shared/i18n.js';
import { Log } from '../shared/log.js';

// Map of currently loaded priorities
export const PRIORITIES = new Map();


function is_valid_priority_key_data(key, data) {
	if(!PackageInfo.is_valid_key_or_id(key))
		return false;

	if(!data)
		return false;

	if(typeof data.id !== 'string' || typeof data.title !== 'string' || typeof data.index !== 'number')
		return false;

	return true;
}

export const load_priorities = function(value=null) {
	// Create existing priorities
	PRIORITIES.clear();

	// Parse config
	const priority_cfg = value ?? game?.settings?.get(PACKAGE_ID, 'module-priorities');
	if(!priority_cfg)
		return;

	for(let type of ['prioritized', 'deprioritized']) {
		const current = priority_cfg[type];
		if(!current)
			continue;

		const base_priority = (type == 'prioritized') ? 10000 : -10000;

		let new_current = null;
		Object.entries(current).forEach(entry => {
			let [key, data] = entry;

			// Check key/data validity
			if(!is_valid_priority_key_data(key, data)) {
				Log.warn$?.(`Ignoring '${key}' entry while loading module priorities due to invalid format.`)
				return;
			}

			// Add to priorities dictionary
			if(PRIORITIES.has(key))
				return;

			PRIORITIES.set(key, base_priority - data.index);
		});
	}
}



// Main settings class
export class LibWrapperSettings extends FormApplication {
	static init() {
		game.settings.register(PACKAGE_ID, 'notify-issues-gm', {
			name: `${PACKAGE_ID}.settings.notify-issues-gm.name`,
			hint: `${PACKAGE_ID}.settings.notify-issues-gm.hint`,
			default: true,
			type: Boolean,
			scope: 'world',
			config: true,
		});

		game.settings.register(PACKAGE_ID, 'notify-issues-player', {
			name: `${PACKAGE_ID}.settings.notify-issues-player.name`,
			hint: `${PACKAGE_ID}.settings.notify-issues-player.hint`,
			default: false,
			type: Boolean,
			scope: 'world',
			config: true,
		});

		game.settings.register(PACKAGE_ID, 'high-performance-mode', {
			name: `${PACKAGE_ID}.settings.high-performance-mode.name`,
			hint: `${PACKAGE_ID}.settings.high-performance-mode.hint`,
			default: false,
			type: Boolean,
			scope: 'world',
			config: true,
		});

		game.settings.register(PACKAGE_ID, 'log-verbosity', {
			name: `${PACKAGE_ID}.settings.log-verbosity.name`,
			hint: `${PACKAGE_ID}.settings.log-verbosity.hint`,
			default: Log.WARNING.value,
			type: Number,
			choices: {
				// NOTE: Some choices removed as too much choice will just confuse users or make technical support more difficult.
				//       For example, I don't want users to disable errors accidentally, and then ask for support without any error messages showing up on console.

				0                   : `${PACKAGE_ID}.settings.log-verbosity.choices.all`     ,
				//[Log.TRACE   .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.trace`   ,
				[Log.DEBUG   .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.debug`   ,
				[Log.INFO    .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.info`    ,
				[Log.WARNING .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.warning` ,
				//[Log.ERROR   .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.error`   ,
				//[Log.CRITICAL.value]: `${PACKAGE_ID}.settings.log-verbosity.choices.critical`,
				//[Log.ALWAYS  .value]: `${PACKAGE_ID}.settings.log-verbosity.choices.always`  ,
			},
			scope: 'client',
			config: true,
			onChange: _ => Log.init(/*force=*/ true)
		});

		game.settings.registerMenu(PACKAGE_ID, 'menu', {
			name: '',
			label: `${PACKAGE_ID}.settings.menu.title`,
			icon: "fas fa-cog",
			type: LibWrapperSettings,
			restricted: true
		});

		game.settings.register(PACKAGE_ID, 'module-priorities', {
			name: '',
			default: {},
			type: Object,
			scope: 'world',
			config: false,
			onChange: _ => load_priorities()
		});

		// Variables
		this.show_ignored_conflicts = false;

		// When done, calculate the logging verbosity
		Log.init();

		// When done, load the priorities
		load_priorities();

		// Seal to prevent accidental modification
		Object.seal(this);
	}


	// Settings UI
	static get defaultOptions() {
		return {
			...super.defaultOptions,
			template: `modules/${PACKAGE_ID}/templates/settings.html`,
			height: 700,
			title: i18n.localize(`${PACKAGE_ID}.settings.menu.title`),
			width: 600,
			classes: [PACKAGE_ID, "settings"],
			tabs: [
				{
					navSelector: '.tabs',
					contentSelector: 'form',
					initial: 'name'
				}
			],
			submitOnClose: false,
			closeOnSubmit: false
		}
	}

	constructor(object = {}, options) {
		super(object, options);
	}

	static showYesNoDialog(msg, yes_callback) {
		new Dialog({
			content: msg,
			buttons: {
				yes: {
					icon: '<i class="fas fa-check"></i>',
					label: i18n.localize(`${PACKAGE_ID}.settings.yes`),
					callback: yes_callback
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: i18n.localize(`${PACKAGE_ID}.settings.no`)
				}
			}
		}).render(true);
	}

	getActiveWrappers() {
		let data = [];

		WRAPPERS.forEach((wrapper) => {
			for(const is_setter of [false, true]) {
				for (const is_notify of [false, true]) {
					if(is_setter && !wrapper.is_property)
						continue;

					// Obtain list of packages
					const packages = [];

					wrapper.get_fn_data(is_setter, is_notify).forEach((fn_data) => {
						if(fn_data.package_info.id == PACKAGE_ID)
							return;

						const d = {
							name     : fn_data.package_info.settingsName,
							type     : fn_data.type.name,
							perf_mode: fn_data.perf_mode.name
						};

						if(d.perf_mode == 'AUTO')
							d.perf_mode = null;
						else
							d.perf_mode = `, ${d.perf_mode}`;

						packages.push(d);
					});

					if(wrapper.detected_classic_wrapper) {
						wrapper.detected_classic_wrapper.forEach((key) => {
							packages.push({
								name     : new PackageInfo(key).settingsName,
								type     : 'MANUAL',
								perf_mode: null
							});
						});
					}

					// We only need to show this to the user if there is at least one active package
					if(packages.length <= 0)
						continue;

					// Obtain remaining information
					const id   = wrapper.get_id(is_setter);
					const names = wrapper.get_names(is_setter);

					data.push({
						id      : id,
						name    : names[0],
						names   : names.slice(1),
						packages: packages
					});
				}
			}
		});

		data.sort((a,b) => b.packages.length - a.packages.length);

		return data;
	}

	getConflicts() {
		if(!LibWrapperStats.collect_stats)
			return null;

		let data = [];

		LibWrapperStats.conflicts.forEach((conflict) => {
			let total = conflict.count;
			if(this.show_ignored_conflicts)
				total += conflict.ignored;

			if(total == 0)
				return;

			const targets = [];

			data.push({
				count: conflict.count,
				ignored: this.show_ignored_conflicts ? conflict.ignored : 0,
				total: total,
				package_id: conflict.package_info.settingsName,
				other_id: conflict.other_info.settingsName,
				targets: targets
			});

			conflict.targets.forEach((obj, target) => {
				let obj_total = obj.count;
				if(this.show_ignored_conflicts)
					obj_total += obj.ignored;

				if(obj_total > 0)
					targets.push({
						target: target,
						count: obj.count,
						total: obj_total,
						ignored: this.show_ignored_conflicts ? obj.ignored : 0
					});
			});

			targets.sort((a,b) => a.total - b.total);
		});

		data.sort((a,b) => a.total - b.total);

		return data;
	}

	getPackages() {
		let ret = {
			prioritized: [],
			normal: [],
			deprioritized: []
		};

		const priorities = game.settings.get(PACKAGE_ID, 'module-priorities');
		const cfg_prioritized   = priorities.prioritized   ?? {};
		const cfg_deprioritized = priorities.deprioritized ?? {};

		const inactive = i18n.localize(`${PACKAGE_ID}.settings.menu.priorities.package-inactive`);

		// Normal packages
		if(LibWrapperStats.collect_stats) {
			LibWrapperStats.packages.forEach((key) => {
				const info = new PackageInfo(key);

				if(info.key in cfg_prioritized || info.key in cfg_deprioritized)
					return;

				ret.normal.push(info);
			});
			ret.normal.sort((a,b) => a.id.localeCompare(b.id));
		}

		// Prioritized packages
		Object.entries(cfg_prioritized).forEach((entry) => {
			let [key, data] = entry;

			// Check key/data validity
			if(!is_valid_priority_key_data(key, data)) {
				Log.warn$?.(`Ignoring '${key}' entry while loading module priorities due to invalid format.`)
				return;
			}

			// Push data
			ret.prioritized.push({
				key  : key,
				id   : data.id,
				title: data.title ?? `${data.title} <${inactive}>`,
				index: data.index
			});
		});
		ret.prioritized.sort((a,b) => { return a.index - b.index });

		// Deprioritized packages
		Object.entries(cfg_deprioritized).forEach((entry) => {
			let [key, data] = entry;

			// In case something went wrong and we have a duplicate package
			if(key in cfg_prioritized)
				return;

			// Check key/data validity
			if(!is_valid_priority_key_data(key, data)) {
				Log.warn$?.(`Ignoring '${key}' entry while loading module priorities due to invalid format.`)
				return;
			}

			// Push data
			ret.deprioritized.push({
				key  : key,
				id   : data.id,
				title: data.title ?? `${data.title} <${inactive}>`,
				index: data.index
			});
		});
		ret.deprioritized.sort((a,b) => { return a.index - b.index });

		// Done
		return ret;
	}

	getData() {
		// Prepare the list of help links
		const support_list = [];
		{
			const key = `${PACKAGE_ID}.support-channels`;
			const list = i18n.localize(key);
			if(Array.isArray(list)) {
				for(const entry of list) {
					if(!('title' in entry) || !('url' in entry))
						continue;

					support_list.push(entry);
				}
			}
		}

		// Create data object
		let data = {
			about: {
				name: PACKAGE_TITLE,
				version: VERSION.full_git,
				collect_stats: LibWrapperStats.collect_stats,
				translation_credits: i18n.localize(`${PACKAGE_ID}.settings.menu.about.credits-translation`),
				support: support_list
			},

			wrappers: this.getActiveWrappers(),
			conflicts: this.getConflicts(),
			packages: this.getPackages(),
			show_ignored_conflicts: this.show_ignored_conflicts
		};

		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);

		let _this = this;

		// Tree view
		html.find('.caret.has-nested').on('click', function(event) {
			const $this = $(this);

			$this.parent().find('.nested').toggleClass('active');
			$this.toggleClass('caret-down');
		});

		// Reload button
		html.find('button.reload').on('click', function(event) {
			_this.render(true);
		});

		// Show ignored conflicts checkbox
		html.find('.lw-show-ignored-conflicts').on('change', function(event) {
			const $this = $(this);
			const checkbox = $this.find('input[type=checkbox]');
			const checked = checkbox.prop('checked');

			_this.show_ignored_conflicts = checked;
			_this.render(true);
		});

		// Easily focus the priority groups
		html.find('.package-priority-group').on('click', function(event) {
			const $this = $(this);

			const select = $this.find('select');

			if(!select.is(':focus'))
				select.focus();
		});

		// Change priority buttons
		html.find('button.change-priority').on('click', function(event) {
			const $this = $(this);

			const which = $this.data('which');
			const direction = $this.data('direction');
			const up = (direction === 'up');

			const list = html.find(`.${which}`);
			const selected = list.find('option:selected');

			const insertPos = up ? selected.prev() : selected.next();

			if(!insertPos.length)
				return;

			if(up)
				insertPos.before(selected);
			else
				insertPos.after(selected);
		});

		// Change category buttons
		html.find('button.change-category').on('click', function(event) {
			const $this = $(this);

			const _from = $this.data('from');
			const _to = $this.data('to');

			const from = html.find(`.${_from}`);
			const to = html.find(`.${_to}`);

			const element = from.find('option:selected');

			// Search for the element to focus next
			let next_focus = element.next();
			if(next_focus.length == 0)
				next_focus = element.prev();

			// Move to the destination list
			to.append(element);

			// If the destination was the 'normal', we need to sort it alphabetically
			if(_to == 'packages-normal') {
				const options = to.find('option');
				options.sort((a,b) => { return $(a).val() > $(b).val() ? 1 : -1 });
				to.empty().append(options);
			}

			// Focus the previous list again
			if(next_focus.length)
				from.val(next_focus.val());

			from.focus();
		});

		// Submit 'Priorities'
		html.find('.submit').on('click', function(event) {
			// Collect prioritization order into hidden fields that will be submitted
			for(let type of ['packages-prioritized', 'packages-deprioritized']) {
				const select = html.find(`.${type}`);

				const options = select.find('option');

				let arr = [];
				options.each((i, option) => {
					arr.push($(option).val());
				});

				$('<input>').attr('type', 'hidden').attr('name', `${type}-hidden`).attr('value', arr.join(',')).appendTo(html);
			}

			html.submit();
		});

		// Reset button
		html.find('.reset').on('click', function(event) {
			$('input[type=hidden]').remove();

			LibWrapperSettings.showYesNoDialog(`<p>${i18n.localize(`${PACKAGE_ID}.settings.menu.warning-reset-priorities`)}</p>`, () => {
				for(let type of ['packages-prioritized', 'packages-deprioritized']) {
					$('<input>').attr('type', 'hidden').attr('name', `${type}-hidden`).attr('value', '').appendTo(html);
				}

				html.submit();
			});
		});
	}

	async _updateObject(ev, formData) {
		// Parse priorities
		const priorities = game.settings.get(PACKAGE_ID, 'module-priorities');

		for(let type of ['prioritized', 'deprioritized']) {
			const fld = `packages-${type}-hidden`;

			if(!(fld in formData))
				continue;

			const value = formData[fld];
			const split = (value === '') ? [] : value.split(',');

			let old_prio = priorities[type] ?? {};
			let new_prio = {};
			let counter = 0;

			split.forEach((key) => {
				if(!key)
					return;

				const old_data = old_prio[key];
				const new_data = new PackageInfo(key);

				new_prio[key] = {
					id   : new_data.id,
					title: new_data.exists ? new_data.title : old_data.title,
					index: counter++
				};
			});

			priorities[type] = new_prio;
		}

		// Sanity check for duplicates
		Object.keys(priorities.deprioritized).forEach((key) => {
			if(key in priorities.prioritized)
				delete priorities.deprioritized[key];
		});

		// Save
		await game.settings.set(PACKAGE_ID, 'module-priorities', priorities);

		// Re-render
		this.render(true);

		// Ask user to refresh page
		LibWrapperSettings.showYesNoDialog(`<p>${i18n.localize(`${PACKAGE_ID}.settings.menu.warning-save`)}</p>`, () => location.reload());
	}
}