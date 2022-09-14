// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./ICampaignSale.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Campaign is ICampaignSale, ReentrancyGuard {
    using Counters for Counters.Counter;

    IERC20 public immutable campaignToken;
    Counters.Counter private campaignIds;

    //Mapping of all campaigns that have been launched. All historical ones are here as well.
    //Cancelled campaigns will not be here
    mapping(uint256 => ICampaignSale.Campaign) private campaigns;

    //Mapping to keep track of the contribution each account has on each of the campaigns
    //campaignId => (accountAddress => contributedAmount)
    mapping(uint256 => mapping(address => uint256))
        private campaignsContributions;

    enum CampaignState {
        NOT_STARTED,
        RUNNING,
        ENDED
    }

    constructor(address _erc20Token) {
        campaignToken = IERC20(_erc20Token);
    }

    modifier campaignExists(uint256 _id) {
        Campaign memory campaign = campaigns[_id];
        require(
            campaign.creator != address(0),
            "Campaign with id passed as parameter does not exists"
        );
        _;
    }

    //Internal method to obtain whether campaign has not started, is running,or has already ended
    function getCampaignState(uint256 _id)
        internal
        view
        campaignExists(_id)
        returns (uint256 state)
    {
        Campaign memory campaign = campaigns[_id];
        (campaign.startAt < block.timestamp && block.timestamp < campaign.endAt)
            ? state = 1
            : (block.timestamp > campaign.endAt)
            ? state = 2
            : state = 0;
        return state;
    }

    /// @notice Launch a new campaign.
    /// @param _goal The goal in token to raise to unlock the tokens for the project
    /// goal is expressed in the smallest ERC20 campaignToken unit
    /// @param _startAt Starting date of the campaign
    /// @param _endAt Ending date of the campaign
    function launchCampaign(
        uint256 _goal,
        uint32 _startAt,
        uint32 _endAt
    ) external {
        require(
            block.timestamp < _startAt,
            "The starting date of the campaign must be in the future"
        );
        require(
            _startAt < _endAt && (_endAt - _startAt) <= 90 days,
            "Ending date must be greater than starting date and campaign should last at max 90 days"
        );
        require(_goal > 0, "Goal to reach must be greater than 0");
        campaignIds.increment();
        uint256 newCampaignId = campaignIds.current();
        Campaign memory newCampaign = Campaign(
            msg.sender,
            _goal,
            0,
            _startAt,
            _endAt,
            false
        );

        campaigns[newCampaignId] = newCampaign;

        emit LaunchCampaign(newCampaignId, msg.sender, _goal, _startAt, _endAt);
    }

    /// @notice Cancel a campaign
    /// @param _id Campaign's id
    function cancelCampaign(uint256 _id) external {
        Campaign memory campaignToCancel = campaigns[_id];
        require(
            getCampaignState(_id) == uint256(CampaignState.NOT_STARTED),
            "Campaign can only be cancelled before it starts"
        );
        require(
            msg.sender == campaignToCancel.creator,
            "Only the creator of the campaign can cancel it"
        );
        campaigns[_id] = Campaign({
            creator: address(0),
            goal: 0,
            pledged: 0,
            startAt: 0,
            endAt: 0,
            claimed: false
        });
        emit CancelCampaign(_id);
    }

    /// @notice Contribute to the campaign for the given amount
    /// @param _id Campaign's id
    /// @param _amount Amount of the contribution
    function contribute(uint256 _id, uint256 _amount) external nonReentrant {
        Campaign memory campaign = campaigns[_id];
        require(
            getCampaignState(_id) == uint256(CampaignState.RUNNING),
            "Campaign must be running in order to receive contributions"
        );
        require(_amount > 0, "Amount should be greater than 0");
        require(
            campaignToken.allowance(msg.sender, address(this)) >= _amount,
            "Inssuficient allowance to complete the transfer associated to this contribution"
        );
        campaignToken.transferFrom(msg.sender, address(this), _amount);
        campaign.pledged = campaign.pledged + _amount;
        campaigns[_id] = campaign;
        campaignsContributions[_id][msg.sender] =
            campaignsContributions[_id][msg.sender] +
            _amount;
        emit Contribute(_id, msg.sender, _amount);
    }

    /// @notice Withdraw an amount from your contribution
    /// @param _id Campaign's id
    /// @param _amount Amount of the contribution to withdraw
    function withdraw(uint256 _id, uint256 _amount) external nonReentrant {
        Campaign memory campaign = campaigns[_id];
        require(
            getCampaignState(_id) == uint256(CampaignState.RUNNING),
            "Campaign must be running in order to enable users withdraw token from campaign"
        );
        require(
            campaignsContributions[_id][msg.sender] >= _amount,
            "User cannot withdraw more than what it has contributed"
        );
        campaignToken.transfer(msg.sender, _amount);
        campaignsContributions[_id][msg.sender] =
            campaignsContributions[_id][msg.sender] -
            _amount;
        campaign.pledged = campaign.pledged - _amount;
        campaigns[_id] = campaign;
        emit Withdraw(_id, msg.sender, _amount);
    }

    /// @notice Claim all the tokens from the campaign
    /// @param _id Campaign's id
    function claimCampaign(uint256 _id) external nonReentrant {
        Campaign memory campaign = campaigns[_id];
        require(
            msg.sender == campaign.creator,
            "Only the creator of the campaign can claim its tokens"
        );
        require(
            getCampaignState(_id) == uint256(CampaignState.ENDED),
            "Campaign should be over in order to claim its tokens"
        );
        require(
            campaign.pledged >= campaign.goal,
            "Campaign goal must have been reached in order to claim its tokens"
        );
       
        require(!campaign.claimed, "Campaign has already been claimed");
        campaignToken.transfer(msg.sender, campaign.pledged);
        campaign.claimed = true;
        campaigns[_id] = campaign;
        emit ClaimCampaign(_id);
    }

    /// @notice Refund all the tokens to the sender
    /// @param _id Campaign's id
    function refundCampaign(uint256 _id) external nonReentrant {
        Campaign memory campaign = campaigns[_id];
        require(
            getCampaignState(_id) == uint256(CampaignState.ENDED),
            "Campaign should be over in order for a user to gets its whole contribution refunded"
        );
        require(
            campaignsContributions[_id][msg.sender] > 0,
            "Only campaing contributors can asked to be refunded"
        );
        require(
            campaign.pledged < campaign.goal,
            "Campaign must has not reached the goal in order for contributors to receive their tokens back"
        );
        campaignToken.transfer(
            msg.sender,
            campaignsContributions[_id][msg.sender]
        );
        emit RefundCampaign(
            _id,
            msg.sender,
            campaignsContributions[_id][msg.sender]
        );
        campaignsContributions[_id][msg.sender] = 0;

    }

    /// @notice Get the campaign info
    /// @param _id Campaign's id
    function getCampaign(uint256 _id)
        external
        view
        campaignExists(_id)
        returns (Campaign memory campaign)
    {
        return campaigns[_id];
    }
}
