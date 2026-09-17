// SPDX-License-Identifier: BUSL-1.1
// Copyright (c) 2026 long.xyz. All rights reserved.
pragma solidity ^0.8.26;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "../vendor/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from
    "../vendor/openzeppelin-contracts-upgradeable/contracts/access/Ownable2StepUpgradeable.sol";
import {OwnableUpgradeable} from "../vendor/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from "../vendor/openzeppelin-contracts-upgradeable/contracts/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from
    "../vendor/openzeppelin-contracts-upgradeable/contracts/utils/cryptography/EIP712Upgradeable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAirlock} from "./interfaces/IAirlock.sol";
import {ILegacyTickerRecords} from "./interfaces/ILegacyTickerRecords.sol";
import {ILongLaunchFactory} from "./interfaces/ILongLaunchFactory.sol";
import {TickerLib} from "./libraries/TickerLib.sol";

/// @title LongLaunchFactory
/// @author @natan_benish
/// @notice Signature-gated, upgradeable (UUPS) Airlock launch router for LONG on Robinhood Chain.
///
/// Every launch must carry an EIP-712 {LaunchAuthorization} signed by a LONG backend signer. The API
/// verifies the full `CreateParams` off-chain (pair, hook, fee schedule, beneficiaries, curves, salt)
/// and signs; this contract enforces the signature plus an on-chain floor that still holds if a
/// signer key leaks: trusted token factory, pinned pool initializer and integrator, ticker rules and
/// reservation (honouring the legacy {LongLauncher} registry), deployed-asset and deployed-symbol
/// post-checks, and the pause switch. The owner can also override a ticker's expiry after the fact
/// ({setTickerExpiry}), including enshrining it forever against copycats.
///
/// The backend only signs. The user's own wallet sends the transaction and pays for the deploy —
/// `msg.sender` is the launcher, exactly as with {LongLauncher}.
///
/// @dev Time is always `block.timestamp`. NEVER use `block.number` on Robinhood Chain: in-EVM it is
/// the Ethereum L1 block number, not the L2 height. Storage is ERC-7201 namespaced and append-only.
contract LongLaunchFactory is
    ILongLaunchFactory,
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardTransient,
    EIP712Upgradeable
{
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ constants

    /// @dev A signer cannot mint authorizations that live longer than this (bounds post-revocation bleed).
    uint48 public constant MAX_AUTHORIZATION_TTL = 1 hours;
    uint48 public constant MIN_RESERVATION_DURATION = 1 hours;
    uint48 public constant MAX_RESERVATION_DURATION = 30 days;
    /// @dev `reservedUntil` sentinel for an enshrined ticker: no future launch may ever use it. Set via
    /// {setTickerExpiry}; `block.timestamp` can never reach it, so the reservation never lapses.
    uint48 public constant PERMANENT_RESERVATION = type(uint48).max;

    bytes32 public constant LAUNCH_AUTHORIZATION_TYPEHASH =
        keccak256("LaunchAuthorization(address launcher,bytes32 paramsHash,address expectedAsset,uint256 deadline)");

    IAirlock public immutable AIRLOCK;
    address public immutable TRUSTED_TOKEN_FACTORY;

    // ------------------------------------------------------------------ storage

    /// @custom:storage-location erc7201:long.storage.LongLaunchFactory
    struct FactoryStorage {
        mapping(bytes32 tickerKey => TickerRecord record) records;
        mapping(address signer => bool enabled) signers;
        uint32 signerCount;
        mapping(bytes32 digest => bool used) consumed;
        address requiredIntegrator;
        address requiredPoolInitializer;
        address legacyLauncher;
        uint48 reservationDuration;
    }

    // keccak256(abi.encode(uint256(keccak256("long.storage.LongLaunchFactory")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant FACTORY_STORAGE_LOCATION =
        0x0dd4d3e28d8aa8da34bde526aedfe33207edd69f19638d2dda94359d597f2300;

    function _s() private pure returns (FactoryStorage storage $) {
        assembly ("memory-safe") {
            $.slot := FACTORY_STORAGE_LOCATION
        }
    }

    // ------------------------------------------------------------------ construction

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address airlock_, address trustedTokenFactory_) {
        if (airlock_ == address(0) || trustedTokenFactory_ == address(0)) revert ZeroAddress();
        AIRLOCK = IAirlock(airlock_);
        TRUSTED_TOKEN_FACTORY = trustedTokenFactory_;
        _disableInitializers();
    }

    /// @notice Proxy initializer. Called atomically from the {ERC1967Proxy} constructor.
    /// @param initialOwner Admin: upgrades, signer rotation, pins, pause, sweeps (2-step transferable).
    /// @param signers Initial authorized signers (at least one).
    /// @param requiredIntegrator_ Pinned `CreateParams.integrator`; zero disables the pin.
    /// @param requiredPoolInitializer_ Pinned `CreateParams.poolInitializer`; zero disables the pin.
    /// @param legacyLauncher_ Legacy {LongLauncher} whose reservations are honoured and whose records
    /// back the views; zero disables the fallback.
    /// @param reservationDuration_ Ticker reservation length for new launches (48h at deploy).
    function initialize(
        address initialOwner,
        address[] calldata signers,
        address requiredIntegrator_,
        address requiredPoolInitializer_,
        address legacyLauncher_,
        uint48 reservationDuration_
    ) external initializer {
        __Ownable_init(initialOwner);
        __Ownable2Step_init();
        __Pausable_init();
        __EIP712_init("LongLaunchFactory", "1");

        if (signers.length == 0) revert NoSigners();
        for (uint256 i; i < signers.length; ++i) {
            _setSigner(signers[i], true);
        }
        _setRequiredIntegrator(requiredIntegrator_);
        _setRequiredPoolInitializer(requiredPoolInitializer_);
        _setLegacyLauncher(legacyLauncher_);
        _setReservationDuration(reservationDuration_);
    }

    receive() external payable {}

    // ------------------------------------------------------------------ launch

    /// @inheritdoc ILongLaunchFactory
    function launch(IAirlock.CreateParams calldata data, LaunchAuthorization calldata auth, bytes calldata signature)
        external
        whenNotPaused
        nonReentrant
        returns (address asset, address pool, address governance, address timelock, address migrationPool)
    {
        FactoryStorage storage $ = _s();

        (bytes32 digest, address signer) = _verifyAuthorization($, data, auth, signature);
        _enforceFloor($, data);
        (bytes32 key, string memory normalizedTicker) = TickerLib.tickerFromTokenFactoryData(data.tokenFactoryData);
        _requireTickerFree($, key, normalizedTicker);

        // Effects before interaction: a reverted Airlock call unwinds this, so a failed launch can be
        // resent with the same authorization until its deadline.
        $.consumed[digest] = true;

        (asset, pool, governance, timelock, migrationPool) = AIRLOCK.create(data);

        if (asset != auth.expectedAsset) revert AssetMismatch(auth.expectedAsset, asset);
        _registerSuccessfulLaunch(
            $,
            data,
            LaunchResult({
                asset: asset, pool: pool, governance: governance, timelock: timelock, migrationPool: migrationPool
            }),
            key,
            normalizedTicker
        );
        emit LaunchAuthorized(asset, signer, msg.sender, digest);
    }

    /// @inheritdoc ILongLaunchFactory
    function hashLaunchAuthorization(LaunchAuthorization calldata auth) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LAUNCH_AUTHORIZATION_TYPEHASH, auth.launcher, auth.paramsHash, auth.expectedAsset, auth.deadline
                )
            )
        );
    }

    function _verifyAuthorization(
        FactoryStorage storage $,
        IAirlock.CreateParams calldata data,
        LaunchAuthorization calldata auth,
        bytes calldata signature
    ) internal view returns (bytes32 digest, address signer) {
        if (auth.launcher != msg.sender) {
            revert UnauthorizedLauncher(auth.launcher, msg.sender);
        }
        if (block.timestamp > auth.deadline) revert AuthorizationExpired(auth.deadline);
        if (auth.deadline > block.timestamp + MAX_AUTHORIZATION_TTL) revert DeadlineTooFar(auth.deadline);

        bytes32 paramsHash = keccak256(abi.encode(data));
        if (paramsHash != auth.paramsHash) revert ParamsHashMismatch(auth.paramsHash, paramsHash);

        digest = hashLaunchAuthorization(auth);
        if ($.consumed[digest]) revert AuthorizationConsumed(digest);

        ECDSA.RecoverError err;
        (signer, err,) = ECDSA.tryRecoverCalldata(digest, signature);
        if (err != ECDSA.RecoverError.NoError || !$.signers[signer]) revert UnauthorizedSigner(signer);
    }

    /// @dev The part of the policy that survives a signer-key leak.
    function _enforceFloor(FactoryStorage storage $, IAirlock.CreateParams calldata data) internal view {
        if (data.tokenFactory != TRUSTED_TOKEN_FACTORY) {
            revert UnsupportedTokenFactory(data.tokenFactory, TRUSTED_TOKEN_FACTORY);
        }
        address initializer = $.requiredPoolInitializer;
        if (initializer != address(0) && data.poolInitializer != initializer) {
            revert UnexpectedPoolInitializer(data.poolInitializer, initializer);
        }
        address integrator = $.requiredIntegrator;
        if (integrator != address(0) && data.integrator != integrator) {
            revert UnexpectedIntegrator(data.integrator, integrator);
        }
    }

    /// @dev Reverts while the ticker is reserved here or on the legacy launcher.
    function _requireTickerFree(FactoryStorage storage $, bytes32 key, string memory normalizedTicker) internal view {
        TickerRecord memory current = $.records[key];
        if (block.timestamp < current.reservedUntil) revert TickerReserved(key, current.token, current.reservedUntil);

        address legacy = $.legacyLauncher;
        if (legacy != address(0)) {
            ILegacyTickerRecords.TickerRecord memory legacyRecord =
                ILegacyTickerRecords(legacy).getTickerRecord(normalizedTicker);
            if (block.timestamp < legacyRecord.reservedUntil) {
                revert TickerReserved(key, legacyRecord.token, legacyRecord.reservedUntil);
            }
        }
    }

    /// @dev The `Airlock.create` return tuple, bundled so {_registerSuccessfulLaunch} stays within the
    /// legacy code generator's stack budget (no `via_ir`).
    struct LaunchResult {
        address asset;
        address pool;
        address governance;
        address timelock;
        address migrationPool;
    }

    function _registerSuccessfulLaunch(
        FactoryStorage storage $,
        IAirlock.CreateParams calldata data,
        LaunchResult memory result,
        bytes32 key,
        string memory normalizedTicker
    ) internal {
        // `normalizeTicker` upper-cases its argument in place; hand it a copy so the raw symbol survives
        // for {LaunchMetadata}.
        string memory deployedSymbol = IERC20Metadata(result.asset).symbol();
        (bytes32 deployedKey,) = TickerLib.normalizeTicker(bytes.concat(bytes(deployedSymbol)));
        if (deployedKey != key) revert DeployedSymbolMismatch(key, deployedKey);

        // Metadata first: the indexer relies on this log preceding LaunchCreated within the transaction.
        emit LaunchMetadata(result.asset, msg.sender, _launchDetails(data, result, deployedSymbol));

        uint256 reservedUntil256 = block.timestamp + $.reservationDuration;
        if (reservedUntil256 > type(uint48).max) revert TimestampOverflow();

        uint48 deployedAt = uint48(block.timestamp);
        uint48 reservedUntil = uint48(reservedUntil256);
        $.records[key] = TickerRecord({token: result.asset, deployedAt: deployedAt, reservedUntil: reservedUntil});

        emit LaunchCreated(
            result.pool,
            result.asset,
            data.numeraire,
            data.poolInitializer,
            msg.sender,
            key,
            deployedAt,
            reservedUntil,
            normalizedTicker
        );
    }

    /// @dev Assembles the {LaunchMetadata} payload from calldata and the `Airlock.create` results. `name`
    /// and `tokenURI` are copied straight out of `tokenFactoryData` (no full `abi.decode`); `symbol` is
    /// the deployed token's raw `symbol()` already fetched for the post-check.
    function _launchDetails(IAirlock.CreateParams calldata data, LaunchResult memory result, string memory symbol)
        private
        pure
        returns (LaunchDetails memory details)
    {
        details.numeraire = data.numeraire;
        details.integrator = data.integrator;
        details.poolInitializer = data.poolInitializer;
        details.liquidityMigrator = data.liquidityMigrator;
        details.governance = result.governance;
        details.timelock = result.timelock;
        details.migrationPool = result.migrationPool;
        details.initialSupply = data.initialSupply;
        details.numTokensToSell = data.numTokensToSell;
        details.name = TickerLib.stringFromTokenFactoryData(data.tokenFactoryData, TickerLib.NAME_HEAD_WORD);
        details.symbol = symbol;
        details.tokenURI = TickerLib.stringFromTokenFactoryData(data.tokenFactoryData, TickerLib.TOKEN_URI_HEAD_WORD);
    }

    // ------------------------------------------------------------------ views

    /// @inheritdoc ILongLaunchFactory
    function tickerKey(string calldata ticker) external pure returns (bytes32 key) {
        (key,) = TickerLib.normalizeTicker(bytes(ticker));
    }

    /// @notice The record for a ticker: this factory's record, or the legacy launcher's when this one has
    /// none. When both exist the most recently deployed wins. Lets every existing consumer
    /// (`isTickerAvailable`/`getTickerRecord` callers, the authenticity checks) keep working with one address.
    function getTickerRecord(string calldata ticker) external view returns (TickerRecord memory record) {
        (bytes32 key, string memory normalizedTicker) = TickerLib.normalizeTicker(bytes(ticker));
        FactoryStorage storage $ = _s();
        record = $.records[key];

        address legacy = $.legacyLauncher;
        if (legacy == address(0)) return record;

        ILegacyTickerRecords.TickerRecord memory legacyRecord =
            ILegacyTickerRecords(legacy).getTickerRecord(normalizedTicker);
        if (legacyRecord.token == address(0)) return record;
        if (record.token == address(0) || legacyRecord.deployedAt > record.deployedAt) {
            return TickerRecord({
                token: legacyRecord.token,
                deployedAt: legacyRecord.deployedAt,
                reservedUntil: legacyRecord.reservedUntil
            });
        }
    }

    /// @inheritdoc ILongLaunchFactory
    function isTickerAvailable(string calldata ticker) external view returns (bool) {
        (bytes32 key, string memory normalizedTicker) = TickerLib.normalizeTicker(bytes(ticker));
        FactoryStorage storage $ = _s();
        if (block.timestamp < $.records[key].reservedUntil) return false;

        address legacy = $.legacyLauncher;
        if (legacy != address(0)) {
            if (block.timestamp < ILegacyTickerRecords(legacy).getTickerRecord(normalizedTicker).reservedUntil) {
                return false;
            }
        }
        return true;
    }

    function isSigner(address account) external view returns (bool) {
        return _s().signers[account];
    }

    function signerCount() external view returns (uint32) {
        return _s().signerCount;
    }

    function isAuthorizationConsumed(bytes32 digest) external view returns (bool) {
        return _s().consumed[digest];
    }

    function requiredIntegrator() external view returns (address) {
        return _s().requiredIntegrator;
    }

    function requiredPoolInitializer() external view returns (address) {
        return _s().requiredPoolInitializer;
    }

    function legacyLauncher() external view returns (address) {
        return _s().legacyLauncher;
    }

    function reservationDuration() external view returns (uint48) {
        return _s().reservationDuration;
    }

    // ------------------------------------------------------------------ admin

    /// @notice Enable or disable a signer. Add the new key before removing the old one for a
    /// zero-downtime rotation; disabling the last signer is refused (pause instead).
    function setSigner(address signer, bool enabled) external onlyOwner {
        _setSigner(signer, enabled);
    }

    function setRequiredIntegrator(address integrator) external onlyOwner {
        _setRequiredIntegrator(integrator);
    }

    function setRequiredPoolInitializer(address poolInitializer) external onlyOwner {
        _setRequiredPoolInitializer(poolInitializer);
    }

    function setLegacyLauncher(address launcher) external onlyOwner {
        _setLegacyLauncher(launcher);
    }

    /// @notice Reservation length for FUTURE launches; existing `reservedUntil` values only change through
    /// {setTickerExpiry}.
    function setReservationDuration(uint48 duration) external onlyOwner {
        _setReservationDuration(duration);
    }

    /// @notice Overrides the reservation expiry of one ticker: shorten it, extend it, or set it to
    /// {PERMANENT_RESERVATION} to enshrine the ticker so no future launch can ever reuse it (copycat /
    /// scam protection for successful tokens). Any value is accepted, including one in the past, which
    /// releases the ticker immediately.
    ///
    /// The record that the merged {getTickerRecord} view currently reports is the one that gets the new
    /// expiry: when this factory has no record for the ticker, or the legacy launcher's record is newer,
    /// the legacy `token` / `deployedAt` are copied here first so the views stay coherent and the
    /// enshrinement survives a later `setLegacyLauncher(0)`. A ticker that was never launched anywhere
    /// gets a record with `token == address(0)`; it still blocks launches while `reservedUntil` is in
    /// the future and is overwritten by the first launch after it lapses.
    /// @param ticker Any case; normalized exactly like a launch (A–Z, 1–15 chars).
    /// @param reservedUntil New expiry (unix timestamp, exclusive) or {PERMANENT_RESERVATION}.
    function setTickerExpiry(string calldata ticker, uint48 reservedUntil) external onlyOwner {
        (bytes32 key, string memory normalizedTicker) = TickerLib.normalizeTicker(bytes(ticker));
        FactoryStorage storage $ = _s();
        TickerRecord storage record = $.records[key];

        address legacy = $.legacyLauncher;
        if (legacy != address(0)) {
            ILegacyTickerRecords.TickerRecord memory legacyRecord =
                ILegacyTickerRecords(legacy).getTickerRecord(normalizedTicker);
            if (
                legacyRecord.token != address(0)
                    && (record.token == address(0) || legacyRecord.deployedAt > record.deployedAt)
            ) {
                record.token = legacyRecord.token;
                record.deployedAt = legacyRecord.deployedAt;
            }
        }

        uint48 previousReservedUntil = record.reservedUntil;
        record.reservedUntil = reservedUntil;
        emit TickerExpiryUpdated(key, record.token, previousReservedUntil, reservedUntil, normalizedTicker);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function sweepNative(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert NativeTransferFailed();
        emit NativeSwept(recipient, amount);
    }

    function sweepERC20(address token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (token == address(0) || recipient == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(recipient, amount);
        emit ERC20Swept(token, recipient, amount);
    }

    function renounceOwnership() public pure override(OwnableUpgradeable) {
        revert OwnershipRenunciationDisabled();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ------------------------------------------------------------------ internal setters

    function _setSigner(address signer, bool enabled) internal {
        if (signer == address(0)) revert ZeroAddress();
        FactoryStorage storage $ = _s();
        if ($.signers[signer] == enabled) return;
        if (enabled) {
            $.signers[signer] = true;
            ++$.signerCount;
        } else {
            if ($.signerCount == 1) revert LastSigner();
            $.signers[signer] = false;
            --$.signerCount;
        }
        emit SignerUpdated(signer, enabled);
    }

    function _setRequiredIntegrator(address integrator) internal {
        _s().requiredIntegrator = integrator;
        emit RequiredIntegratorUpdated(integrator);
    }

    function _setRequiredPoolInitializer(address poolInitializer) internal {
        _s().requiredPoolInitializer = poolInitializer;
        emit RequiredPoolInitializerUpdated(poolInitializer);
    }

    function _setLegacyLauncher(address launcher) internal {
        _s().legacyLauncher = launcher;
        emit LegacyLauncherUpdated(launcher);
    }

    function _setReservationDuration(uint48 duration) internal {
        if (duration < MIN_RESERVATION_DURATION || duration > MAX_RESERVATION_DURATION) {
            revert InvalidReservationDuration(duration);
        }
        _s().reservationDuration = duration;
        emit ReservationDurationUpdated(duration);
    }
}

