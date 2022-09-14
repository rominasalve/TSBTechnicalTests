const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");
let provider = ethers.provider;

function addDaysToDate(date, days) {
  date.setDate(date.getDate() + days);
  return date;
}

describe("Campaign contract", function () {
  let campaignContract;
  let erc20Token;
  let i = 1; //var to be used when increasing dates on tests
  beforeEach(async function () {
    [account0, account1, account2, account3, account4] =
      await ethers.getSigners();
    const ERC20Token = await ethers.getContractFactory("ERC20Test");
    erc20Token = await ERC20Token.deploy("test token", "TERC20");

    let campaign = await ethers.getContractFactory("CampaignSale");

    campaignContract = await campaign.deploy(erc20Token.address);
    await campaignContract.deployed();
  });

  describe("Deployment", function () {
    it("should set erc20Token as the campaignToken, minGoal and maxGoal values", async function () {
      expect(await campaignContract.campaignToken()).to.equal(
        erc20Token.address
      );
    });
  });

  describe("launch campaign ", function () {
    it("should launch campaign with account1 as creator, goal=3000, start in 1 day and have a duration of 1 day (meaning endAt would be now+2 days). It should emit LaunchCampaign event", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await expect(
        campaignContract
          .connect(account1)
          .launchCampaign(3000, _startAt, _endAt)
      )
        .to.emit(campaignContract, "LaunchCampaign")
        .withArgs(1, account1.address, 3000, _startAt, _endAt);

      const campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);
      expect(campaign.startAt).to.equal(_startAt);
      expect(campaign.endAt).to.equal(_endAt);
      expect(campaign.claimed).to.equal(false);
      expect(campaign.pledged).to.equal(0);
    });

    it("should fail launching campaign as startAt parameter is not in the future", async function () {
      const _startAt = new Date("2022.09.02").getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await expect(
        campaignContract
          .connect(account1)
          .launchCampaign(3000, _startAt, _endAt)
      ).to.be.revertedWith(
        "The starting date of the campaign must be in the future"
      );
    });

    it("should fail launching campaign as endAt is before startAt", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      const _endAt = new Date("2022.09.11").getTime() / 1000;

      await expect(
        campaignContract
          .connect(account1)
          .launchCampaign(3000, _startAt, _endAt)
      ).to.be.revertedWith(
        "Ending date must be greater than starting date and campaign should last at max 90 days"
      );
    });

    it("should fail launching campaign as duration is greater than 90 days", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), 92);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await expect(
        campaignContract
          .connect(account1)
          .launchCampaign(3000, _startAt, _endAt)
      ).to.be.revertedWith(
        "Ending date must be greater than starting date and campaign should last at max 90 days"
      );
    });

    it("should fail launching campaign as goal to reach is equal to 0", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await expect(
        campaignContract.connect(account1).launchCampaign(0, _startAt, _endAt)
      ).to.be.revertedWith("Goal to reach must be greater than 0");
    });
  });

  describe("cancel campaign ", function () {
    it("should cancel campaign with id=1 and emit CancelCampaign event", async function () {
      //First, campaign must be created in order to be cancelled

      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      let campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      await expect(campaignContract.connect(account1).cancelCampaign(1))
        .to.emit(campaignContract, "CancelCampaign")
        .withArgs(1);

      //once it gets cancelled, it should not be possible to obtain it
      await expect(campaignContract.getCampaign(1)).to.be.revertedWith(
        "Campaign with id passed as parameter does not exists"
      );
    });

    it("should fail cancelling campaign with id=1 as campaign has already started (is running)", async function () {
      //First, campaign must be created in order to be cancelled
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      const campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      //increment time 1 day ir order to get campaign running
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind. This is why i gets incremented at the end of the test*/

      await expect(
        campaignContract.connect(account1).cancelCampaign(1)
      ).to.be.revertedWith("Campaign can only be cancelled before it starts");

      i = i + 1;
    });

    it("should fail cancelling campaign with id=1 as msg.sender is not campaign creator", async function () {
      //First, campaign must be created in order to be cancelled
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      const campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      //campaign was created by account1 and now is trying to be cancelled by account0
      await expect(campaignContract.cancelCampaign(1)).to.be.revertedWith(
        "Only the creator of the campaign can cancel it"
      );
    });

    it("should fail cancelling campaign with id=2 as there is no campaign with id=2", async function () {
      //First, campaign must be created in order to be cancelled
      await expect(campaignContract.cancelCampaign(2)).to.be.revertedWith(
        "Campaign with id passed as parameter does not exists"
      );
    });
  });

  describe("contribute", function () {
    it("should contribute an amount of 200 to campaign with id=1 with account2 as contributor. It should emit Contribute event", async function () {
      //First, campaign must be created in order to contribute to it
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      let campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      //account2 must approve campaignContract on behalf of an amount equal or greater than
      //200 of its tokens
      //First, account0 must transfer some tokens to account2
      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);

      //increment time 1 day ir order to get campaign running
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind*/

      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);

      i = i + 1;
    });

    it("should fail on trying to contribute to campaign with id=1 as campaign contract has insufficient allowance to complete the transference.", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      //increment time 1 day ir order to get campaign running
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind*/

      //account3 did not approve any allowance to campaign contract. Thus, transferFrom will revert
      await expect(
        campaignContract.connect(account3).contribute(1, 200)
      ).to.be.revertedWith(
        "Inssuficient allowance to complete the transfer associated to this contribution"
      );
      i = i + 1;
    });

    it("should fail on trying to contribute to campaign with id=1 campaign has not been started yet", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      const campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      await expect(campaignContract.contribute(1, 100)).to.be.revertedWith(
        "Campaign must be running in order to receive contributions"
      );
    });

    it("should fail on trying to contribute to campaign with id=2 as there is no campaign with id=2", async function () {
      //First, campaign must be created in order to be cancelled
      await expect(campaignContract.contribute(2, 100)).to.be.revertedWith(
        "Campaign with id passed as parameter does not exists"
      );
    });
  });

  describe("withdraw", function () {
    it("should enable account 2 to withdraw 100 tokens form campaign with id=1, being account2 a contributor. It should emit Withdraw event", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      //account2 must approve campaignContract on behalf of an amount equal or greater than
      //200 of its tokens
      //First, account0 must transfer some tokens to account2
      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);

      //increment time 1 day in order to get campaign running
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind*/

      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);

      let campaign = await campaignContract.getCampaign(1);
      const pledgeBeforeWithdrawal = campaign.pledged;
      const account2Balance1 = await erc20Token.balanceOf(account2.address);

      await expect(campaignContract.connect(account2).withdraw(1, 100))
        .to.emit(campaignContract, "Withdraw")
        .withArgs(1, account2.address, 100);

      campaign = await campaignContract.getCampaign(1);
      const pledgeAfterWithdrawal = campaign.pledged;
      const account2Balance2 = await erc20Token.balanceOf(account2.address);
      expect(account2Balance2).to.equal(account2Balance1.add(100));
      expect(pledgeAfterWithdrawal).to.equal(pledgeBeforeWithdrawal.sub(100));
      i = i + 1;
    });

    it("should fail on trying to withdraw from campaign with id=1 as caller has not made any contribution to it", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind*/

      //account 3 will try to withdraw 200 from campaign funds but it is not a contributor. Thus, it will revert.
      await expect(
        campaignContract.connect(account3).withdraw(1, 200)
      ).to.be.revertedWith(
        "User cannot withdraw more than what it has contributed"
      );
      i = i + 1;
    });

    it("should fail on trying to withdraw from campaign with id=1 as it has not been started yet", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      const campaign = await campaignContract.getCampaign(1);
      expect(campaign.creator).to.equal(account1.address);

      await expect(campaignContract.withdraw(1, 100)).to.be.revertedWith(
        "Campaign must be running in order to enable users withdraw token from campaign"
      );
    });

    it("should fail on trying to withdraw from campaign with id=2 as there is no campaign with id=2", async function () {
      //First, campaign must be created in order to be cancelled
      await expect(campaignContract.withdraw(2, 100)).to.be.revertedWith(
        "Campaign with id passed as parameter does not exists"
      );
    });
  });

  describe("claim", function () {
    it("should enable campaign creator to claim its campaign tokens and emit ClaimCampaign event", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(200, _startAt, _endAt);

      //account2 must approve campaignContract on behalf of an amount equal or greater than
      //200 of its tokens
      //First, account0 must transfer some tokens to account2
      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);
      /*important: time cannot be move backwards in hardhat so the following tests 
      should be done keeping this time increment in mind*/

      let campaign = await campaignContract.getCampaign(1);
      const pledge = campaign.pledged;
      const creatorBalance1 = await erc20Token.balanceOf(account1.address);

      //increase time another day in order to get this campaign finished
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(campaignContract.connect(account1).claimCampaign(1))
        .to.emit(campaignContract, "ClaimCampaign")
        .withArgs(1);
      campaign = await campaignContract.getCampaign(1);
      const creatorBalance2 = await erc20Token.balanceOf(account1.address);
      expect(creatorBalance2).to.equal(creatorBalance1.add(pledge));
      expect(pledge).to.equal(200); //pledge equals goal
      expect(campaign.claimed).to.equal(true);
      i = i + 2;
    });

    it("should fail on trying to claim campaign with id=1 tokens as caller is not campaign creator", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await expect(
        campaignContract.connect(account3).claimCampaign(1)
      ).to.be.revertedWith(
        "Only the creator of the campaign can claim its tokens"
      );
    });

    it("should fail on trying to claim campaign with id=1 tokens as campaign has not finished yet", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);
      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);

      await expect(
        campaignContract.connect(account1).claimCampaign(1)
      ).to.be.revertedWith(
        "Campaign should be over in order to claim its tokens"
      );
      i = i + 1;
    });

    it("should fail on trying to claim campaign with id=1 tokens as campaign has not reached its goal", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);
      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(
        campaignContract.connect(account1).claimCampaign(1)
      ).to.be.revertedWith(
        "Campaign goal must have been reached in order to claim its tokens"
      );
      i = i + 2;
    });
  });

  describe("refund", function () {
    it("should enable campaign contributor to get its refund from campaign with id=1 and emit RefundCampaign event", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(2000, _startAt, _endAt);

      //account2 must approve campaignContract on behalf of an amount equal or greater than
      //200 of its tokens
      //First, account0 must transfer some tokens to account2
      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);
      /*important: time cannot be move backwards in hardhat so the following tests
      should be done keeping this time increment in mind*/

      let campaign = await campaignContract.getCampaign(1);
      const account2BalanceBeforeRefund = await erc20Token.balanceOf(
        account2.address
      );

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(campaignContract.connect(account2).refundCampaign(1))
        .to.emit(campaignContract, "RefundCampaign")
        .withArgs(1, account2.address, 200);
      campaign = await campaignContract.getCampaign(1);
      const account2BalanceAfterRefund = await erc20Token.balanceOf(
        account2.address
      );
      expect(account2BalanceAfterRefund).to.equal(
        account2BalanceBeforeRefund.add(200)
      );
      i = i + 2;
    });

    it("should fail on giving back contributors of campaign with id=1 their tokens as campaign has not finished", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await expect(
        campaignContract.connect(account3).refundCampaign(1)
      ).to.be.revertedWith(
        "Campaign should be over in order for a user to gets its whole contribution refunded"
      );
      i = i + 1;
    });

    it("should fail caller is not a contributor of the campaign passed as parameter", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(3000, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450 * 2]);
      await provider.send("evm_mine");

      await expect(
        campaignContract.connect(account3).refundCampaign(1)
      ).to.be.revertedWith(
        "Only campaing contributors can asked to be refunded"
      );
      i = i + 2;
    });

    it("should fail on giving back contributors of campaign with id=1 their tokens as campaign has reached its goal", async function () {
      let _startAt = addDaysToDate(new Date(), i);
      _startAt =
        new Date(_startAt.toISOString().split("T")[0]).getTime() / 1000;

      let _endAt = addDaysToDate(new Date(), i + 1);
      _endAt = new Date(_endAt.toISOString().split("T")[0]).getTime() / 1000;

      await campaignContract
        .connect(account1)
        .launchCampaign(100, _startAt, _endAt);

      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");

      await erc20Token.transfer(account2.address, 500);
      await erc20Token.connect(account2).approve(campaignContract.address, 300);

      await expect(campaignContract.connect(account2).contribute(1, 200))
        .to.emit(campaignContract, "Contribute")
        .withArgs(1, account2.address, 200);
      await provider.send("evm_increaseTime", [86450]);
      await provider.send("evm_mine");
      await expect(
        campaignContract.connect(account2).refundCampaign(1)
      ).to.be.revertedWith(
        "Campaign must has not reached the goal in order for contributors to receive their tokens back"
      );
      i = i + 2;
    });
  });
});
