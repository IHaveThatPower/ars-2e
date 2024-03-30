/**
 * ARS for 2nd Edition - Roll Tweaks
 * 
 * - Changes Skill rolls to apply the encoded formula modifier as a 
 *   modification to the ability score and thus check target
 *
 * @author  IHaveThatPower <mcc@mcc3d.com>
 */

import { ARS2e } from './ars-2e.js';
import * as utilitiesManager from '/systems/ars/module/utilities.js';
 
export const PatchARSSkillRoll = (SkillRollClass) => {
	ARS2e.log('Patching Roll');
	SkillRollClass.prototype.rollSkill = async function() {
		// Alter checkTarget logic
		if (this.skill && this.abilityCheck)
		{
			// First, reset the check target
			this.checkTarget = parseInt(this.actor.system.abilities[this.skill.system.features.ability].value);
			
			// Next, apply the encoded bonus/penalty
			const formulaModifier = parseInt(this.skill.system.features.modifiers.formula);
			this.checkTarget += formulaModifier;
			
			// Next, remove it from various formulae
			this.rawformula = this.rawformula.replace('@skillModFormula', 0);
			this._formula = this._formula.replace(`+ ${formulaModifier}`, '+ 0');
			
			
			for (let t in this.terms)
			{
				if (this.terms[t].term == `+ ${formulaModifier}` && this.terms[t-1].operator == "-")
				{
					this.terms.splice(t-1, t);
					break;
				}
			}
			ARS2e.log(this.terms);
		}
		let rollOptions = { rollMode: this.rollMode, async: true };
		const roll = await this.roll(rollOptions);

		const naturalRoll = this.dice[0].total;

		this.checkTargetFormula = this.checkTarget; // save this in case we want to display in chat card
		// convert the checkTarget to a evaluated number.
		this.checkTarget = await utilitiesManager.evaluateFormulaValueAsync(this.checkTarget, this.actor.getRollData());
		this.fumble = naturalRoll == 1;
		this.critical = naturalRoll == 20;
		this.success = this.ascending ? roll.total >= this.checkTarget : roll.total <= this.checkTarget;
		this.checkDiff = Math.abs(roll.total - this.checkTarget);
		return roll;
	}
};