/**
 * ARS for 2nd Edition - Actor Tweaks
 * 
 * - Changes Encumbrance to use the Specific Encumbrance model
 * - Adds a path by which mount encumbrance can be invoked instead of
 *   STR-based encumbrance
 * - Adds a path by which bonus spell memorizations are granted to 
 *   specialists
 *
 * @author  IHaveThatPower <mcc@mcc3d.com>
 */

import { ARS2e } from './ars-2e.js';
 
export const PatchARSActor = (ActorDocumentClass) => {
	ARS2e.log('Patching Actor');
	class ARS2eActor extends ActorDocumentClass {
		static MOUNT_EFFECT_NAME = 'Mount Capacity';

		// Define mapping between encumbrance levels and their indices
		static encumbranceLevelIndices = {
			unencumbered: 6,
			light: 7, // 2/3
			moderate: 8, // 1/2
			heavy: 9, // 1/3
			severe: 10, // = 1
			max: 11, // = 1
		};
		
		// Define the mount Strength table
		static mountStrengthTable = {
			camel: [330, 500], // Base, 2/3, 1/3 is 2* Base
			dog: [15, 20],
			elephant: [500, 750],
			horseDraft: [260, 390],
			horseHeavy: [260, 390],
			horseLight: [170, 255],
			horseMedium: [220, 330],
			horseRiding: [180, 270],
			mule: [250, 375],
			ox: [220, 330],
			yak: [220, 330]
		};

		/**
		 * Override for the movement getter to support granular
		 * movement penalties.
		 * 
		 * @override
		 * @return  int
		 */
		get movement() {
			if (ARS2e.getVariant() != 2)
				return super.movement;
			
			// Get some current info
			const currentMove = this.type === 'npc' ? this.system.movement : this.system.attributes.movement.value;
			const carryWeight = this._getCarriedWeight();
			let move = parseInt(currentMove);
			
			// Initialize some variables we'll use
			let carryUnencumbered = 0;
			let carryMax = 0;

			// If we're not a mount, use the humanoid table
			if (!this.getFlag(ARS2e.MODULE_NAME, 'mount-type'))
			{
				// Compute strength value based on ability
				const strengthValue = this.computedStrengthValue();
				
				// Get strength data from the strength table
				const strengthData = CONFIG.ARS.strengthTable[ARS2e.getVariant()][strengthValue];
				const strengthKeys = CONFIG.ARS.strengthTable[ARS2e.getVariant()][0];
				
				// Compute the range between max. unencumbered and max possible
				carryUnencumbered = strengthData[strengthKeys.indexOf('ARS.abilityFields.str.encumbrance.unencumbered')];
				carryMax = strengthData[strengthKeys.indexOf('ARS.abilityFields.str.encumbrance.max')];

				// If we're dealing with Str 3 or less, we just do it manually, because it's so fiddly
				if (strengthValue <= 3)
				{
					// Take care of some always-true situations
					if (carryWeight < carryUnencumbered)
						return move;
					if (carryWeight >= carryMax)
						return 10;
					
					// Okay, figure it out
					const moveMultiplier = move / 120;
					let adjustedMove = move / 10;
					switch (strengthValue)
					{
						case 3:
							if (carryWeight >= 5 && carryWeight < 6)
								adjustedMove = 10;
							else if (carryWeight >= 6 && carryWeight < 7)
								adjustedMove = 8;
							else if (carryWeight >= 7 && carryWeight < 8)
								adjustedMove = 5;
							else if (carryWeight >= 8 && carryWeight < 9)
								adjustedMove = 3;
							else
								adjustedMove = 1;
							break;
						default:
							if (carryWeight >= 1 && carryWeight < 2)
								adjustedMove = 10;
							else if (carryWeight >= 2 && carryWeight < 3)
								adjustedMove = 7;
							else if (carryWeight >= 3 && carryWeight < 4)
								adjustedMove = 4;
							else
								adjustedMove = 1;
							break;
					}
					return Math.floor(adjustedMove * moveMultiplier, 0) * 10;
				}
			}
			// Okay, we're a mount!
			else
			{
				const mountCarry = this.getMountCarry();
				carryUnencumbered = mountCarry[0];
				carryMax = mountCarry[0] * 2;
			}
			
			// Take care of some always-true situations
			if (carryWeight < carryUnencumbered)
				return move;
			if (carryWeight >= carryMax)
				return 10;
			
			// Compute the granular values
			const carryRange = carryMax - carryUnencumbered;
			let encMoveStep = carryRange / (move / 10); // This is the amount of weight above unencumbered per point of move reduction
			if (encMoveStep > 1)
				encMoveStep = Math.round(encMoveStep, 0);
			//ARS2e.log('Determined move step of ', encMoveStep);
			
			// This is the number of steps down from maximum move
			let moveReduce = 10 * (Math.floor((carryWeight - carryUnencumbered) / encMoveStep) + 1);
			//ARS2e.log('Determined basic move band of', moveReduce);
			// If the value * 10 is larger than our move, we're not moving
			if (moveReduce == move)
				return 10;
			if (moveReduce > move)
				return 0;
			if (carryWeight == carryUnencumbered) // This is always one step down
				return move - 10;
			return Math.round((move - moveReduce)/10, 0)*10;
		}

		/**
		 * Override for the encumbrance getter to support alternate
		 * mount encumbrance
		 * 
		 * @override
		 * @return  int
		 */
		get encumbrance() {
			// If we're not in v2, just return the parent
			if (ARS2e.getVariant() != 2)
				return super.encumbrance;

			const actualCarriedWeight = this._getCarriedWeight();
			
			// If we're not a mount, use the humanoid table
			if (!this.getFlag(ARS2e.MODULE_NAME, 'mount-type'))
			{
				ARS2e.log(this.name, ' does not have the effect');
				return super.encumbrance;
				// TBD: May revisit this
				/*
				// Compute strength value based on ability
				const strengthValue = this.computedStrengthValue();
			
				// Get strength data from the strength table
				const strengthData = CONFIG.ARS.strengthTable[ARS2e.getVariant()][strengthValue];

				// Find and return the first encumbrance level where the actual carried weight is less than or equal to the corresponding strength value
				for (let index = 6; index < strengthData.length; index++) {
					let encumbranceLevel = Object.keys(ARS2e.encumbranceLevelIndices).find(
						(key) => ARS2e.encumbranceLevelIndices[key] === index
					);
					if (actualCarriedWeight <= strengthData[index]) {
						return encumbranceLevel;
					}
				}

				// If no encumbrance level found, return 'max'
				return 'max';
				*/
			}
			
			const mountCarry = this.getMountCarry()
			if (mountCarry === false)
				return 'unencumbered';
			if (actualCarriedWeight <= mountCarry[0])
				return 'unencumbered';
			if (actualCarriedWeight > mountCarry[0] && actualCarriedWeight <= mountCarry[1])
				return 'light';
			if (actualCarriedWeight > mountCarry[1] && actualCarriedWeight < mountCarry[0]*2)
				return 'heavy';
			if (actualCarriedWeight >= mountCarry[0]*2)
				return 'max';
		}

		/**
		 * Helper for computing the actual carry weight
		 * 
		 * @return  float
		 */
		_getCarriedWeight() {
			const magicArmorWeight = this.armors
					.filter((armor) => armor.isMagic)
					.reduce(
						(totalWeight, armor) => totalWeight + parseInt(armor.system.weight) * parseInt(armor.system.quantity) || 0,
						0
					);
			return parseInt(Number(this.carriedweight).toFixed(0)) - magicArmorWeight;
		}
		
		/**
		 *
		 * We need to back up any existing memorizations that the base
		 * class might consider outside the acceptable range, so that 
		 * we can restore them later if we decide we need to
		 *
		 * @param {*} data
		 */
		_prepareMemorizationSlotData(data) {
			const systemVariant = ARS2e.getVariant();
			if (systemVariant != 2) return super._prepareMemorizationSlotData(data);
			
			ARS2e.log("Prepare Slot Data", data);
			this.backupMemorization = foundry.utils.deepClone(data.spellInfo.memorization)
			const ret = super._prepareMemorizationSlotData(data);
			this._prepareBonusSlotData();
			return ret;
		}
		
		/**
		 * Here's where we'll update our memorizations to better-reflect
		 * what's up with our slots.
		 * 
		 * @return    void
		 */
		_prepareBonusSlotData() {
			if (this.items?.filter(i => i.type == 'ability' && i.name == 'Specialist Wizard Spells').length > 0)
			{
				ARS2e.log(this.name, 'specialist slots!');
				const spellInfo = this.system.spellInfo;
				let totalSlots = this.system.memorizations.arcane.totalSlots;
				let spellSlots = this.system.memorizations.arcane.spellslots;
				ARS2e.log(this.name,'spellSlots variable',{...spellSlots});
				// Go through and add one memorization to each spell level that has any memorization entries
				for (let l = 0; l < Object.keys(spellInfo.memorization.arcane).length; l++)
				{
					if (spellInfo.slots.arcane.value[l] > 0)
					{
						const numMemorized = Object.keys(spellInfo.memorization.arcane[l]).length;
						ARS2e.log(this.name,'adding level',l,'memorization slot');
						ARS2e.log(`Total slots incrementing from ${totalSlots} to...`);
						totalSlots += 1;
						ARS2e.log(`${totalSlots}`);
						ARS2e.log(`Spell slots incrementing from ${spellSlots.value[l]} to...`);
						spellSlots.value[l] += 1;
						ARS2e.log(`${spellSlots.value[l]}`);
						spellInfo.memorization.arcane[l][numMemorized] = {name: null, level: l};
						if (this.backupMemorization.arcane[l][numMemorized])
						{
							ARS2e.log(this.name,'restoring memorized spell',this.backupMemorization.arcane[l][numMemorized],'from backup');
							spellInfo.memorization.arcane[l][numMemorized] = this.backupMemorization.arcane[l][numMemorized]
						}
					}
				}
				ARS2e.log("Overwriting memSlots with",spellInfo.memorization.arcane);
				this.system.memorizations.arcane.memslots = foundry.utils.deepClone(spellInfo.memorization.arcane);
				this.system.memorizations.arcane.totalSlots = totalSlots;
			}
		}
		
		/**
		 * Get the carry capacity details for the current mount
		 * 
		 * @return array|false
		 */
		getMountCarry() {
			// What kind of mount are we?
			const mountType = this.getFlag(ARS2e.MODULE_NAME, 'mount-type');
			if (!ARS2eActor.mountStrengthTable[mountType])
			{
				ARS2e.log(`Mount Type '${mountType}' not found; will consider unencumbered`);
				return false;
			}
			return ARS2eActor.mountStrengthTable[mountType];
		}
		
		/**
		 * Override carry weight; return mount weight, or else
		 * internal property
		 * 
		 * @override
		 * @return     int
		 */
		get maxWeight() {
			if (ARS2e.getVariant() == 2 && !!this.getFlag(ARS2e.MODULE_NAME, 'mount-type'))
			{
				const mountCarry = this.getMountCarry();
				if (mountCarry !== false)
					return mountCarry[0];
			}
			return this._maxWeight;
		}
		
		/**
		 * Set internal max weight property
		 * 
		 * @override
		 * @param     int
		 * @return    void
		 */
		set maxWeight(value) {
			this._maxWeight = value;
		}
	}
	const constructorName = "ARS2eActor";
	Object.defineProperty(ARS2eActor.prototype.constructor, "name", { value: constructorName });
	return ARS2eActor;
};

export const PatchARSActorSheet = (actorSheet) => {
	ARS2e.log('Patching ARSActorSheet');
	// Patch onItemImageClicked to support the nearby carat
	(function(toReplace) {
		actorSheet.prototype.onItemImageClicked = function() {
			const event = arguments[0];
			if (event.currentTarget.parentElement.nodeName != 'LI') // Carat, so change the target and re-emit
			{
				const closestItemImage = event?.currentTarget?.closest('li.item')?.querySelector('.item-image');
				if (closestItemImage)
					return closestItemImage.click();
				return false;
			}
			return toReplace.apply(this, arguments);
		};
	})(actorSheet.prototype.onItemImageClicked);
	
	// Patch activateListeners to also listen for the carat click events
	(function(toReplace) {
		actorSheet.prototype.activateListeners = function() {
			// Register all the normal listeners
			toReplace.apply(this, arguments);
		
			// Add the carat listener
			const html = arguments[0][0];
			const collapseCarats = html.querySelectorAll('li.item div.item-container-collapsed i[id^="inventory-container-icon"]');
			collapseCarats.forEach(c => {
				c.addEventListener('click', (event) => this.onItemImageClicked(event, html));
			});
		};
	})(actorSheet.prototype.activateListeners);
	
	// Patch _onSelectedSpell to avoid issues with selecting an empty
	// slot.
	(function(toReplace) {
		actorSheet.prototype._onSelectedSpell = async function() {
			const event = arguments[0];
			event.preventDefault();
			
			const element = event.currentTarget;
			const actor = this.actor;
			const spellId = element.value;
			const li = element.closest('li');
			const dataset = li.dataset;
			const [type, level, index] = [dataset.type, dataset.level, dataset.index];
			if (!spellId)
			{
				let memSlots = foundry.utils.deepClone(actor.system.spellInfo.memorization);
				if (!memSlots[type][level]) memSlots[type][level] = new Array();
				memSlots[type][level][index] = {
					name: null,
					level: level,
					cast: false,
				};
				await this.actor.update({ 'system.spellInfo.memorization': memSlots });
				return;
			}
			return toReplace.apply(this, arguments);
		};
	})(actorSheet.prototype._onSelectedSpell);
};

/**
 * Restructure the PC character sheet header
 * 
 * @param    sheet
 * @param    html
 * @param    data
 * @return   void
 */
export const PatchSheetLayout = (sheet, html, data) => {
	class PatchCharacterSheet {
		static patchHeaderAndDetails(html) {
			if (!html.matches('div.ars.sheet.actor.character')) {
				return; // Not the PC sheet
			}
			
			// Patch the header
			this.patchHeader(html);
				
			// Find the basic details block
			const basicDetails = html.querySelector('section.sheet-body div.tab.main div.flexcol');
			if (!basicDetails) throw "Couldn't find basic details div";
			// Move it to the header
			// header.prepend(basicDetails);
			basicDetails.classList.add('character-details');

			// Patch all the related elements
			const flavorRow = this.createFlavorRow(basicDetails);
			this.patchPortraitImage(html);
			this.patchDetailsFields(basicDetails);
			this.wrapDetailsPairs(basicDetails);
		}
		
		/**
		 * Patch the header -- name and help icons
		 * 
		 * @param    html
		 * @return   void
		 */
		static patchHeader(html) {
			// ARS2e.log("Patching header");
			// Find the header
			const header = html.querySelector('header.sheet-header.character');
			if (!header) throw "Couldn't find the header";
			
			// Find the name field
			const nameInput = html.querySelector('header.sheet-header.character input[name="name"]');
			if (!nameInput) throw "Couldn't find the name input field";
			// Wrap it in a flex row
			const nameRow = document.createElement('div');
			nameRow.classList.add('flexrow');
			nameRow.classList.add('character-name');
			nameRow.appendChild(nameInput);
			// Move it to the beginning of the basic details block
			header.prepend(nameRow);
			// Strip off any explicit style declarations
			nameInput.removeAttribute('style');
			
			this.cleanUpIconColumn(html);
		}

		/**
		 * Clean up the icon column to make it a bit prettier
		 * 
		 * @param    html
		 * @return   void
		 */
		static cleanUpIconColumn(html) {
			const iconColumn = html.querySelector('header.sheet-header > div.flexrow:last-child');
			// Strip off explicit styling
			iconColumn.removeAttribute('style');
			// Attach it instead to the character name element
			const charName = html.querySelector('header.sheet-header div.character-name');
			charName.appendChild(iconColumn);
			// Give it a class so we can manipulate it more easily
			iconColumn.classList.add('help-column');
			iconColumn.classList.add('flexcol');
			iconColumn.classList.remove('flexrow');
			
			// Remove explicit styling from children
			for (let c of iconColumn.children) {
				c.removeAttribute('style');
			}
		}
		
		/**
		 * Create the flavor row that contains both the portrait
		 * and the character details
		 * 
		 * @param    basicDetails
		 * @return   void
		 */
		static createFlavorRow(basicDetails) {
			// ARS2e.log("Creating the flavor row");
			const flavorRow = document.createElement('div');
			flavorRow.classList.add('flexrow');
			flavorRow.classList.add('character-flavor');
			basicDetails.parentNode.prepend(flavorRow);
			flavorRow.appendChild(basicDetails);
			return flavorRow;
		}
		
		/**
		 * Patches the portrait image to live with the other character
		 * details
		 * 
		 * @param    basicDetails
		 * @return   void
		 */
		static patchPortraitImage(html) {
			// ARS2e.log("Moving the portrait");
			// Create a container div for details and the image side-by-side
			const charImage = html.querySelector('header.sheet-header.character img.profile-img');
			// const container = html.querySelector('header.sheet-header').parentNode;
			// container.prepend(charImage);
			const container = html.querySelector('div.character-flavor')
			container.appendChild(charImage);
		}
		
		/**
		 * Patches aspects of the character details fields to make
		 * them easier to identify, as well as manipulates their layout
		 * 
		 * @param    basicDetails
		 * @return   void
		 */
		static patchDetailsFields(basicDetails) {
			// ARS2e.log("Patching details fields");
			// Add identifiers to each row
			const flexRows = basicDetails.querySelectorAll('div.flexrow');
			// ARS2e.log(flexRows);
			for (let i = 0; i < flexRows.length; i++)
			{
				switch (i)
				{
					case 0: // First row is class and race
						flexRows[i].classList.add('class-race');
						const classRaceEls = flexRows[i].querySelectorAll('*');
						for (let el of classRaceEls) {
							el.removeAttribute('style');
						}
						break;
					case 1: // Second row is alignment and background, which we're going to remove and replace with size
						flexRows[i].classList.add('alignment-size');
						const backgroundEls = flexRows[i].querySelectorAll('select[name="system.details.alignment"]+div, div+div.resource');
						for (let el of backgroundEls) {
							flexRows[i+1].appendChild(el);
						}
						break;
					case 2: // Third row is currently size and nothing, which we're going to replace with background, and subsequently hide
						flexRows[i].classList.add('background-only');
						const sizeEls = flexRows[i].querySelectorAll('div:first-child, select[name="system.attributes.size"]');
						for (let el of sizeEls) {
							flexRows[i-1].appendChild(el);
						}
						break;
				}
			}
		}
		
		/**
		 * Wrap each basic detail pair in a containing element
		 * 
		 * @param    basicDetails
		 * @return   void
		 */
		static wrapDetailsPairs(basicDetails) {
			// ARS2e.log("Wrapping detail pairs");
			const flexRows = basicDetails.querySelectorAll('div.flexrow.class-race,div.flexrow.alignment-size');
			for (let i = 0; i < flexRows.length; i++)
			{
				// Wrap each paired set of controls in its own div
				const containedEls = flexRows[i].querySelectorAll(':scope > *');
				//ARS2e.log(containedEls);
				for (let d = 0; d < containedEls.length; d+=2)
				{
					// Create a wrapper for each pair
					let wrapperDiv = document.createElement('div');
					if (d == 0 && i == 0)
						wrapperDiv.classList.add('class');
					else if (d == 2 && i == 0)
						wrapperDiv.classList.add('race');
					else if (d == 0 && i == 1)
						wrapperDiv.classList.add('alignment');
					else if (d == 2 && i == 1)
						wrapperDiv.classList.add('size');
					else {
						ARS2e.log("Unexpected d/i pair:",d,i);
						continue;
					}
					flexRows[i].appendChild(wrapperDiv);
					wrapperDiv.appendChild(containedEls[d]);
					wrapperDiv.appendChild(containedEls[d+1]);
				}
			}
		}
		
		/**
		 * Replace the "legend" tags with basic header divs instead
		 * 
		 * @param    html
		 * @return   void
		 */
		static patchAbilitySaves(html) {
			// ARS2e.log("Patching ability scores and saves headers");
			if (!html.matches('div.ars.sheet.actor.character')) {
				return; // Not the PC sheet
			}
			// Replace legend tags with div.general-header tags
			const legendEls = html.querySelectorAll('fieldset.ability-tables legend, fieldset.save-stats legend');
			if (!legendEls) throw "No legend elements found";
			for (let l of legendEls)
			{
				// Create a new node
				let divEl = document.createElement('div');
				divEl.classList.add('general-header');
				divEl.innerHTML = l.innerHTML;
				l.replaceWith(divEl);
			}
		}
		
		/**
		 * Override default listeners on the portrait
		 * 
		 * @param    html
		 * @return   void
		 */
		static patchPortraitListeners(sheet, html, data) {
			const portrait = html.querySelector('img.profile-img, img.npc-profile-img');
			if (!portrait) return; // Nothing to do
			
			const showTokenPortrait = false; // Could be configurable in the future, the way 5e does it
			// const token = data.token ?: data.actor.prototypeToken;
			// const img = data.token?.texture?.src ? data.token.texture.src : data.actor.img;
			const img = data.actor.img;
			
			// Add the right-click listener
			portrait.addEventListener('contextmenu', function(e) {
				e.preventDefault();
				e.stopPropagation();
				new ImagePopout(img, { title: data.actor.name, uuid: data.actor.uuid}).render(true);
				return false;
			});
		}
		
		/**
		 * Helper to gracefully log caught errors
		 * 
		 * @param    error
		 * @return   void
		 */
		static handleError(error) {
			if (!(error instanceof Error))
				error = new Error(error);
			ARS2e.err(error.message);
		}
	}
	
	let useHTML = html[0];
	// We might've gotten the form instead of the full sheet, which will throw us off
	if (useHTML.matches('form'))
		useHTML = useHTML.closest('div');
	
	// Patch header
	try {
		PatchCharacterSheet.patchHeaderAndDetails(useHTML);
	}
	catch (error) {
		PatchCharacterSheet.handleError(error);
	}
	// Patch ability/saves
	try {
		PatchCharacterSheet.patchAbilitySaves(useHTML);
	}
	catch (error) {
		PatchCharacterSheet.handleError(error);
	}
	
	// Patch portrait interaction
	try {
		PatchCharacterSheet.patchPortraitListeners(sheet, useHTML, data);
	}
	catch (error) {
		PatchCharacterSheet.handleError(error);
	}
};