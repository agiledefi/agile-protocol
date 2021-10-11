pragma solidity ^0.5.16;
import "./SafeBEP20.sol";
import "./IBEP20.sol";
import "./XAIVaultProxy.sol";
import "./XAIVaultStorage.sol";
import "./XAIVaultErrorReporter.sol";

contract XAIVault is XAIVaultStorage {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    /// @notice Event emitted when XAI deposit
    event Deposit(address indexed user, uint256 amount);

    /// @notice Event emitted when XAI withrawal
    event Withdraw(address indexed user, uint256 amount);

    /// @notice Event emitted when admin changed
    event AdminTransfered(address indexed oldAdmin, address indexed newAdmin);

    constructor() public {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can");
        _;
    }

    /*** Reentrancy Guard ***/

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    modifier nonReentrant() {
        require(_notEntered, "re-entered");
        _notEntered = false;
        _;
        _notEntered = true; // get a gas-refund post-Istanbul
    }

    /**
     * @notice Deposit XAI to XAIVault for AGL allocation
     * @param _amount The amount to deposit to vault
     */
    function deposit(uint256 _amount) public nonReentrant {
        UserInfo storage user = userInfo[msg.sender];

        updateVault();

        // Transfer pending tokens to user
        updateAndPayOutPending(msg.sender);

        // Transfer in the amounts from user
        if(_amount > 0) {
            xai.safeTransferFrom(address(msg.sender), address(this), _amount);
            user.amount = user.amount.add(_amount);
        }

        user.rewardDebt = user.amount.mul(accAGLPerShare).div(1e18);
        emit Deposit(msg.sender, _amount);
    }

    /**
     * @notice Withdraw XAI from XAIVault
     * @param _amount The amount to withdraw from vault
     */
    function withdraw(uint256 _amount) public nonReentrant {
        _withdraw(msg.sender, _amount);
    }

    /**
     * @notice Claim AGL from XAIVault
     */
    function claim() public nonReentrant {
        _withdraw(msg.sender, 0);
    }

    /**
     * @notice Low level withdraw function
     * @param account The account to withdraw from vault
     * @param _amount The amount to withdraw from vault
     */
    function _withdraw(address account, uint256 _amount) internal {
        UserInfo storage user = userInfo[account];
        require(user.amount >= _amount, "withdraw: not good");

        updateVault();
        updateAndPayOutPending(account); // Update balances of account this is not withdrawal but claiming AGL farmed

        if(_amount > 0) {
            user.amount = user.amount.sub(_amount);
            xai.safeTransfer(address(account), _amount);
        }
        user.rewardDebt = user.amount.mul(accAGLPerShare).div(1e18);

        emit Withdraw(account, _amount);
    }

    /**
     * @notice View function to see pending AGL on frontend
     * @param _user The user to see pending AGL
     */
    function pendingAGL(address _user) public view returns (uint256)
    {
        UserInfo storage user = userInfo[_user];

        return user.amount.mul(accAGLPerShare).div(1e18).sub(user.rewardDebt);
    }

    /**
     * @notice Update and pay out pending AGL to user
     * @param account The user to pay out
     */
    function updateAndPayOutPending(address account) internal {
        uint256 pending = pendingAGL(account);

        if(pending > 0) {
            safeAGLTransfer(account, pending);
        }
    }

    /**
     * @notice Safe AGL transfer function, just in case if rounding error causes pool to not have enough AGL
     * @param _to The address that AGL to be transfered
     * @param _amount The amount that AGL to be transfered
     */
    function safeAGLTransfer(address _to, uint256 _amount) internal {
        uint256 aglBal = agl.balanceOf(address(this));

        if (_amount > aglBal) {
            agl.transfer(_to, aglBal);
            aglBalance = agl.balanceOf(address(this));
        } else {
            agl.transfer(_to, _amount);
            aglBalance = agl.balanceOf(address(this));
        }
    }

    /**
     * @notice Function that updates pending rewards
     */
    function updatePendingRewards() public {
        uint256 newRewards = agl.balanceOf(address(this)).sub(aglBalance);

        if(newRewards > 0) {
            aglBalance = agl.balanceOf(address(this)); // If there is no change the balance didn't change
            pendingRewards = pendingRewards.add(newRewards);
        }
    }

    /**
     * @notice Update reward variables to be up-to-date
     */
    function updateVault() internal {
        uint256 xaiBalance = xai.balanceOf(address(this));
        if (xaiBalance == 0) { // avoids division by 0 errors
            return;
        }

        accAGLPerShare = accAGLPerShare.add(pendingRewards.mul(1e18).div(xaiBalance));
        pendingRewards = 0;
    }

    /**
     * @dev Returns the address of the current admin
     */
    function getAdmin() public view returns (address) {
        return admin;
    }

    /**
     * @dev Burn the current admin
     */
    function burnAdmin() public onlyAdmin {
        emit AdminTransfered(admin, address(0));
        admin = address(0);
    }

    /**
     * @dev Set the current admin to new address
     */
    function setNewAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0), "new owner is the zero address");
        emit AdminTransfered(admin, newAdmin);
        admin = newAdmin;
    }

    /*** Admin Functions ***/

    function _become(XAIVaultProxy xaiVaultProxy) public {
        require(msg.sender == xaiVaultProxy.admin(), "only proxy admin can change brains");
        require(xaiVaultProxy._acceptImplementation() == 0, "change not authorized");
    }

    function setAgileInfo(address _agl, address _xai) public onlyAdmin {
        agl = IBEP20(_agl);
        xai = IBEP20(_xai);

        _notEntered = true;
    }
}