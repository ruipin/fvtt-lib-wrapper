// SPDX-License-Identifier: LGPL-3.0-or-later
// Copyright © 2020 fvtt-lib-wrapper Rui Pinheiro

'use strict';

import {MODULE_ID, MODULE_TITLE, VERSION, TYPES_REVERSE} from '../consts.js';
import {LibWrapperStats} from './stats.js';
import {WRAPPERS} from '../utils/misc.js';


export class LibWrapperSettings extends FormApplication {
	static init() {
		game.settings.register(MODULE_ID, 'notify-issues-gm', {
			name: 'Notify GM of Issues',
			default: true,
			type: Boolean,
			scope: 'world',
			config: true,
			hint: 'Whether to notify GMs when an issue is detected, for example a conflict.'
		});

		game.settings.register(MODULE_ID, 'notify-issues-player', {
			name: 'Notify Players of Issues',
			default: false,
			type: Boolean,
			scope: 'world',
			config: true,
			hint: 'Whether to notify Players when an issue is detected, for example a conflict.'
		});

		game.settings.registerMenu(MODULE_ID, 'menu', {
			name: '',
			label: `${MODULE_TITLE} Settings Menu`,
			icon: "fas fa-cog",
			type: LibWrapperSettings,
			restricted: true
		});

		game.settings.register(MODULE_ID, 'module-priorities', {
			name: '',
			default: {},
			type: Object,
			scope: 'world',
			config: false,
			onChange: value => globalThis.libWrapper.load_priorities()
		});
	}


	// Settings UI
	static get defaultOptions() {
		return {
			...super.defaultOptions,
			template: `modules/${MODULE_ID}/templates/settings.html`,
			height: 700,
			title: `${MODULE_TITLE} Settings Menu`,
			width: 600,
			classes: [MODULE_ID, "settings"],
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
					label: 'Yes',
					callback: yes_callback
				},
				no: {
					icon: '<i class="fas fa-times"></i>',
					label: 'No'
				}
			}
		}).render(true);
	}

	getActiveWrappers() {
		let data = [];

		WRAPPERS.forEach((wrapper) => {
			for(let is_setter of [false, true]) {
				if(is_setter && !wrapper.is_property)
					continue;

				let name = wrapper.name;
				if(is_setter)
					name = `${name}#set`;

				let _d = {
					name  : name,
					modules: []
				};

				wrapper.get_fn_data(is_setter).forEach((fn_data) => {
					if(fn_data.module == MODULE_ID)
						return;

					_d.modules.push({
						name    : fn_data.module,
						type    : TYPES_REVERSE[fn_data.type]
					});
				});

				if(wrapper.detected_classic_wrapper) {
					wrapper.detected_classic_wrapper.forEach((module) => {
						_d.modules.push({
							name    : module,
							type    : 'MANUAL'
						});
					});
				}

				if(_d.modules.length > 0)
					data.push(_d);
			}
		});

		data.sort((a,b) => b.modules.length - a.modules.length);

		return data;
	}

	getConflicts() {
		if(!LibWrapperStats.collect_stats)
			return null;

		let data = [];

		LibWrapperStats.conflicts.forEach((conflict) => {
			let targets = [];

			data.push({
				count: conflict.count,
				module: conflict.module,
				other: conflict.other,
				targets: targets
			});

			conflict.targets.forEach((count, target) => {
				targets.push({target: target, count: count});
			});

			targets.sort((a,b) => a.count - b.count);
		});

		data.sort((a,b) => a.count - b.count);

		return data;
	}

	getModules() {
		let data = {
			prioritized: [],
			normal: [],
			deprioritized: []
		};

		const priorities = game.settings.get(MODULE_ID, 'module-priorities');
		const cfg_prioritized   = priorities.prioritized   ?? {};
		const cfg_deprioritized = priorities.deprioritized ?? {};

		// Normal modules
		if(LibWrapperStats.collect_stats) {
			LibWrapperStats.modules.forEach((module_id) => {
				const module_data = game.modules.get(module_id).data;

				if(module_id in cfg_prioritized || module_id in cfg_deprioritized)
					return;

				data.normal.push({
					id: module_id,
					title: module_data.title
				});
			});
			data.normal.sort((a,b) => {return a.id - b.id});
		}

		// Prioritized modules
		Object.entries(cfg_prioritized).forEach((entry) => {
			const [module_id, module_info] = entry;
			const module_data = game.modules.get(module_id)?.data;

			data.prioritized.push({
				id: module_id,
				title: module_data?.title ?? `${module_info.title} <Inactive>`,
				index: module_info.index
			});
		});
		data.prioritized.sort((a,b) => { return a.index - b.index });

		// Deprioritized modules
		Object.entries(cfg_deprioritized).forEach((entry) => {
			const [module_id, module_info] = entry;

			// In case something went wrong and we have a duplicate module
			if(module_id in cfg_prioritized)
				return;

			const module_data = game.modules.get(module_id)?.data;

			data.deprioritized.push({
				id: module_id,
				title: module_data?.title ?? `${module_info.title} <Inactive>`,
				index: module_info.index
			});
		});
		data.deprioritized.sort((a,b) => { return a.index - b.index });

		// Done
		return data;
	}

	getData() {
		let data = {
			about: {
				name: MODULE_TITLE,
				version: VERSION,
				collect_stats: LibWrapperStats.collect_stats
			},

			wrappers: this.getActiveWrappers(),
			conflicts: this.getConflicts(),
			modules: this.getModules()
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
		html.find('button#reload').on('click', function(event) {
			_this.render(true);
		});

		// Easily focus the priority groups
		html.find('.module-priority-group').on('click', function(event) {
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

			const list = html.find(`#${which}`);
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

			const from = html.find(`#${_from}`);
			const to = html.find(`#${_to}`);

			const element = from.find('option:selected');

			// Search for the element to focus next
			let next_focus = element.next();
			if(next_focus.length == 0)
				next_focus = element.prev();

			// Move to the destination list
			to.append(element);

			// If the destination was the 'normal', we need to sort it alphabetically
			if(_to == 'modules-normal') {
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
		html.find('#submit').on('click', function(event) {
			// Collect prioritization order into hidden fields that will be submitted
			for(let type of ['modules-prioritized', 'modules-deprioritized']) {
				const select = html.find(`#${type}`);

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
		html.find('#reset').on('click', function(event) {
			$('input[type=hidden]').remove();

			LibWrapperSettings.showYesNoDialog("<p>Resetting the module priorities will move all modules back to 'Unprioritized'. This action cannot be undone. Are you sure you want to continue?</p>", () => {
				for(let type of ['modules-prioritized', 'modules-deprioritized']) {
					$('<input>').attr('type', 'hidden').attr('name', `${type}-hidden`).attr('value', '').appendTo(html);
				}

				html.submit();
			});
		});
	}

	async _updateObject(ev, formData) {
		// Parse priorities
		const priorities = game.settings.get(MODULE_ID, 'module-priorities');

		for(let type of ['prioritized', 'deprioritized']) {
			const fld = `modules-${type}-hidden`;

			if(!(fld in formData))
				continue;

			const value = formData[fld];
			const split = (value === '') ? [] : value.split(',');

			let old_prio = priorities[type] ?? {};
			let new_prio = {};
			let counter = 0;

			split.forEach((module_id) => {
				if(!module_id)
					return;

				const old_data = old_prio[old_prio];
				const new_data = game.modules.get(module_id)?.data;

				new_prio[module_id] = {
					title: new_data?.title ?? old_data?.title ?? '<Unknown>',
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
		await game.settings.set(MODULE_ID, 'module-priorities', priorities);

		// Re-render
		this.render(true);

		// Ask user to refresh page
		LibWrapperSettings.showYesNoDialog("<p>It is recommended you reload this page to apply the new module priorities. Do you wish to reload?</p>", () => location.reload());
	}
}
Object.freeze(LibWrapperSettings);