"use client";

import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useCallback, useEffect, useId, useState } from "react";
import { DEPARTMENTS, MAX_ADDRESSES } from "@/config/colombia";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FormMessage,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  submitWithoutReset,
} from "@/components/ui/form";
import { focusRing } from "@/components/ui/styles";
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
  type AccountFormState,
} from "./actions";
import { useAccountErrorText } from "./profile-form";

export interface AddressView {
  id: string;
  label: string;
  recipient: string;
  phone: string;
  department: string;
  city: string;
  line1: string;
  line2: string | null;
  notes: string | null;
  isDefault: boolean;
}

const initialState: AccountFormState = { status: "idle" };
const smallButton = cn(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-raised hover:text-fg",
  focusRing,
);

function AddressForm({
  address,
  cities,
  onDone,
}: {
  address: AddressView | null;
  cities: string[];
  onDone: () => void;
}) {
  const t = useTranslations("Account");
  const ta = useTranslations("Auth");
  const errorText = useAccountErrorText();
  const citiesId = useId();
  const [state, action, pending] = useActionState(saveAddressAction, initialState);
  const fieldErrors = state.fieldErrors ?? {};
  const value = (name: keyof AddressView) => (address?.[name] as string | null | undefined) ?? "";

  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  return (
    <form
      action={action}
      onSubmit={submitWithoutReset(action)}
      className="flex flex-col gap-4 rounded-2xl border border-cyan-fg/40 bg-surface p-5 sm:p-6"
      noValidate
      aria-labelledby={`${citiesId}-title`}
    >
      <h2 id={`${citiesId}-title`} className="font-display text-lg font-semibold">
        {address ? t("editAddress") : t("newAddress")}
      </h2>
      {address ? <input type="hidden" name="id" value={address.id} /> : null}
      {state.error ? <FormMessage tone="error">{errorText(state.error)}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("label")} hint={t("labelHint")} error={errorText(fieldErrors.label)}>
          {(props) => (
            <TextInput
              {...props}
              name="label"
              maxLength={40}
              required
              defaultValue={value("label")}
            />
          )}
        </Field>
        <Field label={t("recipient")} error={errorText(fieldErrors.recipient)}>
          {(props) => (
            <TextInput
              {...props}
              name="recipient"
              autoComplete="name"
              maxLength={80}
              required
              defaultValue={value("recipient")}
            />
          )}
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} error={errorText(fieldErrors.phone)}>
          {(props) => (
            <TextInput
              {...props}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              required
              defaultValue={value("phone")}
            />
          )}
        </Field>
        <Field label={t("department")} error={errorText(fieldErrors.department)}>
          {(props) => (
            <Select {...props} name="department" required defaultValue={value("department")}>
              <option value="" disabled>
                {t("selectDepartment")}
              </option>
              {DEPARTMENTS.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t("city")} error={errorText(fieldErrors.city)}>
          {(props) => (
            <>
              <TextInput
                {...props}
                name="city"
                list={citiesId}
                autoComplete="address-level2"
                maxLength={60}
                required
                defaultValue={value("city")}
              />
              <datalist id={citiesId}>
                {cities.map((city) => (
                  <option key={city} value={city} />
                ))}
              </datalist>
            </>
          )}
        </Field>
        <Field label={t("line1")} hint={t("line1Hint")} error={errorText(fieldErrors.line1)}>
          {(props) => (
            <TextInput
              {...props}
              name="line1"
              autoComplete="address-line1"
              maxLength={120}
              required
              defaultValue={value("line1")}
            />
          )}
        </Field>
      </div>
      <Field label={t("line2")} error={errorText(fieldErrors.line2)}>
        {(props) => (
          <TextInput
            {...props}
            name="line2"
            autoComplete="address-line2"
            maxLength={120}
            defaultValue={value("line2")}
          />
        )}
      </Field>
      <Field label={t("notes")} error={errorText(fieldErrors.notes)}>
        {(props) => (
          <TextArea
            {...props}
            name="notes"
            maxLength={240}
            rows={2}
            defaultValue={value("notes")}
          />
        )}
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault}
          className={cn("size-4 accent-primary", focusRing)}
        />
        {t("isDefault")}
      </label>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
        <SubmitButton pendingLabel={ta("pending")} pending={pending} className="sm:w-auto">
          {t("save")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddressManager({
  addresses,
  cities,
}: {
  addresses: AddressView[];
  cities: string[];
}) {
  const t = useTranslations("Account");
  // null: list only; "new": create form; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const close = useCallback(() => setEditing(null), []);
  const editingAddress = addresses.find((address) => address.id === editing) ?? null;
  const atLimit = addresses.length >= MAX_ADDRESSES;

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <AddressForm key={editing} address={editingAddress} cities={cities} onDone={close} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button onClick={() => setEditing("new")} disabled={atLimit} className="sm:w-auto">
            <Plus className="size-4" aria-hidden="true" />
            {t("addAddress")}
          </Button>
          <p className="text-xs text-muted">{t("addressLimit", { max: MAX_ADDRESSES })}</p>
        </div>
      )}

      {addresses.length === 0 && !editing ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
          <MapPin className="size-8 text-cyan-fg" aria-hidden="true" />
          <p className="text-muted">{t("noAddresses")}</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display font-semibold">{address.label}</h2>
                {address.isDefault ? <Badge tone="cyan">{t("default")}</Badge> : null}
              </div>
              <address className="text-sm leading-relaxed text-muted not-italic">
                {address.recipient} · {address.phone}
                <br />
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.department}
                {address.notes ? (
                  <>
                    <br />
                    {address.notes}
                  </>
                ) : null}
              </address>
              <div className="mt-auto flex flex-wrap gap-1 border-t border-line pt-3">
                <button
                  type="button"
                  className={smallButton}
                  onClick={() => setEditing(address.id)}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                  {t("edit")}
                  <span className="sr-only">: {address.label}</span>
                </button>
                {!address.isDefault ? (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={address.id} />
                    <button type="submit" className={smallButton}>
                      <Star className="size-3.5" aria-hidden="true" />
                      {t("makeDefault")}
                      <span className="sr-only">: {address.label}</span>
                    </button>
                  </form>
                ) : null}
                <form
                  action={deleteAddressAction}
                  onSubmit={(event) => {
                    if (!window.confirm(t("deleteConfirm", { label: address.label })))
                      event.preventDefault();
                  }}
                >
                  <input type="hidden" name="id" value={address.id} />
                  <button type="submit" className={cn(smallButton, "hover:text-pink-fg")}>
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {t("delete")}
                    <span className="sr-only">: {address.label}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
