/**
 * ARS for 2nd Edition - Inventory Sheet Tweaks
 * 
 * Updates the inventory list on an actor sheet to display weights for
 * non-carried items and total up container weights.
 *
 * @author  IHaveThatPower <mcc@mcc3d.com>
 */

import { ARS2e } from './ars-2e.js';

export class ARS2eInventory
{
	
	/**
	 * When rendering an actor sheet, transform not-carried item rows
	 * to still display their total weight. Also transform containers
	 * to display their total weight.
	 * 
	 * @param    sheet
	 * @param    html
	 * @param    data
	 * @return   void
	 */
	static transformInventoryWeight(sheet, html, data) {
		// Find all not-carried items
		const itemsNotCarried = data.items.filter(i => i.system?.location?.state == 'nocarried' && i.system?.weight > 0);
		this.updateNonCarriedWeights(itemsNotCarried);
		
		// Update all containers
		const itemsContainers = data.items.filter(i => i.contains?.length > 0 && i.type != 'race' && i.type != 'skill' && i.type != 'ability' && i.type != 'class' && i.type != 'spell');
		this.updateContainerTotalWeights(itemsContainers);
		
		// Update the display
		for (const i of data.items)
		{
			if (!!i.nonCarriedWeight || !!i.containedWeight)
			{
				const selector = `li.item[data-item-id="${i.id}"]`;
				const el = html[0].querySelector(selector);
				if (!el) continue;
				const cells = el.querySelectorAll('div.medium-field');
				if (!cells) continue;
				const cell = cells[cells.length-1];
				if (!cell) continue;
				let displayWeight = +parseFloat(this.getProperItemWeight(i).toFixed(2)) + '';
				// Is it a container?
				if (i.contains?.length > 0)
				{
					const totalWeight = +(parseFloat(this.getProperItemWeight(i)) + parseFloat(i.containedWeight)).toFixed(2);
					// const containedWeight = +parseFloat(i.containedWeight).toFixed(2);
					//displayWeight = `${totalWeight} (${displayWeight}+${containedWeight})`;
					displayWeight = `${totalWeight}*`;
				}
				if (i.system?.location?.state == 'nocarried')
					displayWeight = `[${displayWeight}]`;
				cell.innerHTML = displayWeight;
			}
		}
	}
	
	/**
	 * Helper function to set a weight property for items that are
	 * not carried.
	 * 
	 * @param    itemsNotCarried
	 * @return   void
	 */
	static updateNonCarriedWeights(itemsNotCarried)
	{
		for (const i of itemsNotCarried)
		{
			if (!i.system?.quantity)
			{
				//ARS2e.log(i.name,'no quantity value',i);
				continue;
			}
			if (!i.system?.weight)
			{
				//ARS2e.log(i.name,'no weight value',i);
				continue;
			}
			i.nonCarriedWeight = null;
			i.nonCarriedWeight = this.getProperItemWeight(i);
		}
	}
	
	/**
	 * Helper function to recursively update the weights of containers
	 * so that they display their total contained weight.
	 * 
	 * @param    itemsContainers
	 * @return   void
	 */
	static updateContainerTotalWeights(itemsContainers)
	{
		for (const c of itemsContainers)
		{
			const containedItems = c.contains;
			let containedWeight = 0;
			for (const i of containedItems)
			{
				if (i.contains?.length > 0)
					this.updateContainerTotalWeights([i]);
				// ARS2e.log(c.name,'contains',i.name,'so adding',this.getProperItemWeight(i));
				containedWeight += this.getProperItemWeight(i) || 0;
			}
			// ARS2e.log(c.name,'computed weight as',containedWeight);
			c.containedWeight = containedWeight;
		}
	}
	
	/**
	 * Helper that gets the "proper" weight of an item
	 * 
	 * @param    item
	 * @return   float|null
	 */
	static getProperItemWeight(item)
	{
		if (item.nonCarriedWeight)
			return item.nonCarriedWeight;
		if (!!item.carriedWeight && item.carriedWeight > 0)
			return item.carriedWeight;
		if (item.system?.quantity && item.system?.weight)
			return item.system?.quantity * item.system?.weight;
	}
}