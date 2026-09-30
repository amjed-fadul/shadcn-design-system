import * as React from "react"
import { createRoot } from "react-dom/client"
import "../../src/index.css"
import { Button } from "../../src/components/ui/button"
import { Field, FieldGroup, FieldLabel, Form } from "../../src/components/ui/field"
import { Input } from "../../src/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "../../src/components/ui/input-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../src/components/ui/select"

// Every form records its submit count and last FormData in the DOM so the
// browser test can assert on native behavior without touching React state.
function record(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = event.currentTarget
  form.dataset.submits = String(Number(form.dataset.submits ?? "0") + 1)
  form.dataset.data = JSON.stringify(Object.fromEntries(new FormData(form).entries()))
}

function Fixture() {
  const [visible, setVisible] = React.useState(false)
  return (
    <>
      <Form id="login" aria-label="Log in" onSubmit={record}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="login-user">Username</FieldLabel>
            <Input id="login-user" name="username" autoComplete="username" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="login-pass">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput id="login-pass" name="password" type={visible ? "text" : "password"} autoComplete="current-password" required />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((value) => !value)}>
                  {visible ? "Hide" : "Show"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Button type="submit">Log in</Button>
        </FieldGroup>
      </Form>

      <Form id="skip-validation" aria-label="Skip validation" noValidate onSubmit={record}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nv-email">Email</FieldLabel>
            <Input id="nv-email" name="email" type="email" required />
          </Field>
          <Button type="submit">Send</Button>
        </FieldGroup>
      </Form>

      <Form id="plan" aria-label="Plan" onSubmit={record}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="plan-select">Plan</FieldLabel>
            <Select name="plan" defaultValue="starter">
              <SelectTrigger id="plan-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit">Choose</Button>
        </FieldGroup>
      </Form>

      <Form id="native-get" aria-label="Native GET" action="./form-native-target.html" method="get" autoComplete="off">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="get-q">Query</FieldLabel>
            <Input id="get-q" name="q" />
          </Field>
          <Button type="submit">Search</Button>
        </FieldGroup>
      </Form>
    </>
  )
}

createRoot(document.getElementById("root")!).render(<Fixture />)
