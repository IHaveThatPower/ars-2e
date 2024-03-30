/**
 * ARS for 2nd Edition
 * 
 * Overrides several aspects of default ARS behavior to better-conform
 * to 2nd Edition play
 *
 * @author  IHaveThatPower <mcc@mcc3d.com>
 */

export class ARS2e
{
	static MODULE_NAME = 'ars-2e';
	static log = window.console.log.bind(window.console, this.MODULE_NAME.toUpperCase()+" | ");
	static error = window.console.error.bind(window.console, this.MODULE_NAME.toUpperCase()+" | ");

	/**
	 * Simple way to retrieve the configured system variant
	 * 
	 * @return  int
	 */
	static getVariant()
	{
		return parseInt(game.ars.config.settings.systemVariant);
	}
	
	/**
	 * Wrapper around the Handlebars log helper to silence ARS's noisy
	 * logging messages.
	 * 
	 * @param   logHelper
	 * @return  void
	 */
	static patchHandlebarsLog = (logHelper) => {
		ARS2e.log("Patching Handlebars log helper");
		(function(toReplace) {
			Handlebars.helpers.log = function() {
				const template = arguments[0];
				if (template.match(/^[^\s]+\.hbs/))
					return; // Just eat it
				return toReplace.apply(this, arguments);
			};
		})(logHelper);
	};
}

import { PatchARSActor, PatchARSActorSheet, PatchSheetLayout } from './ars-2e-actor.js';
import { ARS2eInventory } from './ars-2e-inventory.js';
import { PatchARSSkillRoll } from './ars-2e-roll.js';

Hooks.once('init', () => {
	CONFIG.Actor.documentClass = PatchARSActor(CONFIG.Actor.documentClass);
	const rollSkillIdx = CONFIG.Dice.rolls.findIndex(r => r.prototype.constructor.name == 'ARSRollSkill');
	PatchARSSkillRoll(CONFIG.Dice.rolls[rollSkillIdx]);
	PatchARSActorSheet(game.ars.ARSActorSheet);
	ARS2e.patchHandlebarsLog(Handlebars.helpers.log);
});
Hooks.on('renderARSActorSheet', (sheet, html, data) => {
	PatchSheetLayout(sheet, html, data);
	ARS2eInventory.transformInventoryWeight(sheet, html, data);
});