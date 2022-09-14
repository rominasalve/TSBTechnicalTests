# TSB Technical Test. Part J)
***
In this exercise, you have been given specifications and your goal is to develop a smart
contract that satisfies those. This contract should be named “CampaignSale.sol” and
implements the interface “ICampaignSale.sol” included in this test. This interface includes comments that should help you build your contract. Here are the specifications:We are building a fundraising dApp that enables creators to publish their projects in order to raise money in the form of ERC20 tokens. A campaign lasts for a duration and has to raise a minimum goal to unlock the development of the project & the tokens
invested by contributors. Otherwise, the contributors can get refunded.

### Launching a campaign
A campaign can be created by any user and should include:
- the starting date of the campaign that should be in the future
- the ending date of the campaign that should be in the future, greater than the
starting date. Also a campaign should last at max 90 days.
- The goal to reach (token amount)

### Canceling a campaign
A campaign can be canceled before it starts. The campaign is then no longer accessible and
should be deleted. Only the creator of the campaign can cancel it

### Contributing to a campaign
A user can contribute to the campaign by sending an amount of tokens to the contract only if the
campaign is running.

### Withdrawing from a campaign
A user can withdraw an amount of token from a campaign only if the campaign is running. Then,
that amount of tokens is sent back to the user.
Claiming the token from a campaign
Once a campaign is over, the creator of the campaign is able to claim all the tokens only if the
goal of the campaign has been reached. A campaign can be claimed only once.

### Refunding a campaign
If the campaign didn’t reach the goal after the campaign is over, the contributors can still get
refunded. A contributor will receive back his whole contribution (tokens) to the campaign.